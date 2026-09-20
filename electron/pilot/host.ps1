# ---------------------------------------------------------------------------
# Pilot host - a long-lived PowerShell process that owns the accessibility
# tree and synthetic input.
#
# Why a persistent process: spawning powershell.exe per action costs 250-400ms
# before a single byte of work happens, which alone blows the per-step budget.
# This process is started once, loads UIAutomation and its P/Invoke surface
# once, and then answers JSON requests on stdin in single-digit to low tens of
# milliseconds.
#
# Protocol: one JSON object per line in, one JSON object per line out.
#   in   {"id":1,"op":"tree","handle":0,"maxNodes":400}
#   out  {"id":1,"ok":true,"data":{...}}       or  {"id":1,"ok":false,"error":"..."}
#
# Nothing here decides anything. It reports what is on screen and performs
# exactly the click or keystroke it is told to. All judgement lives in
# lib/pilot/grounder.ts and lib/pilot/runner.ts.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
# System.Windows.Point lives in WindowsBase and FromPoint needs it.
Add-Type -AssemblyName WindowsBase

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public struct POINT { public int X; public int Y; }

[StructLayout(LayoutKind.Sequential)]
public struct MOUSEINPUT {
  public int dx; public int dy; public uint mouseData;
  public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
}

[StructLayout(LayoutKind.Sequential)]
public struct KEYBDINPUT {
  public ushort wVk; public ushort wScan; public uint dwFlags;
  public uint time; public IntPtr dwExtraInfo;
}

[StructLayout(LayoutKind.Sequential)]
public struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }

[StructLayout(LayoutKind.Explicit)]
public struct INPUTUNION {
  [FieldOffset(0)] public MOUSEINPUT mi;
  [FieldOffset(0)] public KEYBDINPUT ki;
  [FieldOffset(0)] public HARDWAREINPUT hi;
}

[StructLayout(LayoutKind.Sequential)]
public struct INPUT { public uint type; public INPUTUNION u; }

public static class PilotNative {
  public const uint INPUT_MOUSE = 0;
  public const uint INPUT_KEYBOARD = 1;

  public const uint MOUSEEVENTF_MOVE          = 0x0001;
  public const uint MOUSEEVENTF_LEFTDOWN      = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP        = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN     = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP       = 0x0010;
  public const uint MOUSEEVENTF_MIDDLEDOWN    = 0x0020;
  public const uint MOUSEEVENTF_MIDDLEUP      = 0x0040;
  public const uint MOUSEEVENTF_WHEEL         = 0x0800;
  public const uint MOUSEEVENTF_ABSOLUTE      = 0x8000;
  public const uint MOUSEEVENTF_VIRTUALDESK   = 0x4000;

  public const uint KEYEVENTF_KEYUP   = 0x0002;
  public const uint KEYEVENTF_UNICODE = 0x0004;

  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);

  public static string WindowTitle(IntPtr hWnd) {
    StringBuilder sb = new StringBuilder(512);
    GetWindowTextW(hWnd, sb, sb.Capacity);
    return sb.ToString();
  }

  // Mouse coordinates for SendInput are 0..65535 across the VIRTUAL desktop,
  // not the primary monitor - getting this wrong puts every click on a
  // multi-monitor setup onto the wrong screen.
  public static void MoveMouse(int x, int y) {
    int vx = GetSystemMetrics(76);  // SM_XVIRTUALSCREEN
    int vy = GetSystemMetrics(77);  // SM_YVIRTUALSCREEN
    int vw = GetSystemMetrics(78);  // SM_CXVIRTUALSCREEN
    int vh = GetSystemMetrics(79);  // SM_CYVIRTUALSCREEN
    if (vw <= 0) vw = 1;
    if (vh <= 0) vh = 1;

    INPUT[] input = new INPUT[1];
    input[0].type = INPUT_MOUSE;
    input[0].u.mi.dx = (int)(((double)(x - vx) * 65535.0) / vw);
    input[0].u.mi.dy = (int)(((double)(y - vy) * 65535.0) / vh);
    input[0].u.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
  }

  public static void MouseButton(uint downFlag, uint upFlag) {
    INPUT[] input = new INPUT[2];
    input[0].type = INPUT_MOUSE;
    input[0].u.mi.dwFlags = downFlag;
    input[1].type = INPUT_MOUSE;
    input[1].u.mi.dwFlags = upFlag;
    SendInput(2, input, Marshal.SizeOf(typeof(INPUT)));
  }

  public static void Wheel(int amount) {
    INPUT[] input = new INPUT[1];
    input[0].type = INPUT_MOUSE;
    input[0].u.mi.mouseData = unchecked((uint)amount);
    input[0].u.mi.dwFlags = MOUSEEVENTF_WHEEL;
    SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
  }

  // Typed as Unicode scan codes rather than SendKeys, so the text needs no
  // escaping and does not depend on the active keyboard layout: an emoji, a
  // brace and an Urdu character all arrive intact.
  public static void TypeUnicode(string text) {
    if (string.IsNullOrEmpty(text)) return;
    INPUT[] input = new INPUT[text.Length * 2];
    for (int i = 0; i < text.Length; i++) {
      input[i * 2].type = INPUT_KEYBOARD;
      input[i * 2].u.ki.wScan = text[i];
      input[i * 2].u.ki.dwFlags = KEYEVENTF_UNICODE;
      input[i * 2 + 1].type = INPUT_KEYBOARD;
      input[i * 2 + 1].u.ki.wScan = text[i];
      input[i * 2 + 1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
    }
    SendInput((uint)input.Length, input, Marshal.SizeOf(typeof(INPUT)));
  }
}
'@

# Without this, UI Automation hands back DPI-virtualised rectangles on a
# scaled display and every click lands short of its target.
[void][PilotNative]::SetProcessDPIAware()

$UIA = [System.Windows.Automation.AutomationElement]
$TreeScope = [System.Windows.Automation.TreeScope]

# ---------------------------------------------------------------------------
# Accessibility tree
# ---------------------------------------------------------------------------

function Get-UiElements {
  param([long]$Handle, [int]$MaxNodes = 400)

  $root = if ($Handle -eq 0) {
    [System.Windows.Automation.AutomationElement]::FromHandle([PilotNative]::GetForegroundWindow())
  } else {
    [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Handle)
  }
  if ($null -eq $root) { throw 'no window to read' }

  # One cache request means one cross-process round trip for every property of
  # every node. Reading them live instead is the single biggest cost in a
  # naive UIA walk - easily 20x slower on a browser window.
  $cache = New-Object System.Windows.Automation.CacheRequest
  $cache.Add($UIA::NameProperty)
  $cache.Add($UIA::ControlTypeProperty)
  $cache.Add($UIA::BoundingRectangleProperty)
  $cache.Add($UIA::AutomationIdProperty)
  $cache.Add($UIA::ClassNameProperty)
  $cache.Add($UIA::IsEnabledProperty)
  $cache.Add($UIA::HelpTextProperty)
  # Cache-only elements: we never touch a live property or a control pattern,
  # so there is no reason to pay for the live reference.
  $cache.AutomationElementMode = [System.Windows.Automation.AutomationElementMode]::None

  $onScreen = New-Object System.Windows.Automation.PropertyCondition($UIA::IsOffscreenProperty, $false)

  $activation = $cache.Activate()
  try {
    $found = $root.FindAll($TreeScope::Descendants, $onScreen)
  } finally {
    $activation.Dispose()
  }

  $elements = New-Object System.Collections.ArrayList
  $count = [Math]::Min($found.Count, $MaxNodes)
  for ($i = 0; $i -lt $count; $i++) {
    $el = $found[$i]
    try {
      $rect = $el.Cached.BoundingRectangle
      # A zero-area rectangle cannot be clicked, so it is noise to the grounder.
      if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }
      $name = [string]$el.Cached.Name
      $automationId = [string]$el.Cached.AutomationId
      # An element with no name and no id is unaddressable - it can only ever
      # be hit by raw coordinates, which is exactly what we are avoiding.
      if ([string]::IsNullOrWhiteSpace($name) -and [string]::IsNullOrWhiteSpace($automationId)) { continue }

      $type = [string]$el.Cached.ControlType.ProgrammaticName
      if ($type.StartsWith('ControlType.')) { $type = $type.Substring(12) }

      [void]$elements.Add([pscustomobject]@{
        name    = $name
        role    = $type
        id      = $automationId
        cls     = [string]$el.Cached.ClassName
        help    = [string]$el.Cached.HelpText
        enabled = [bool]$el.Cached.IsEnabled
        x       = [int]$rect.X
        y       = [int]$rect.Y
        w       = [int]$rect.Width
        h       = [int]$rect.Height
      })
    } catch {
      # A node that vanished between FindAll and the read is normal on a live
      # screen; skip it rather than failing the whole tree.
      continue
    }
  }

  return [pscustomobject]@{
    elements  = @($elements)
    total     = $found.Count
    truncated = ($found.Count -gt $count)
  }
}

function Get-WindowInfo {
  param([long]$Handle = 0)

  $hwnd = if ($Handle -eq 0) { [PilotNative]::GetForegroundWindow() } else { [IntPtr]$Handle }
  if (-not [PilotNative]::IsWindow($hwnd)) { throw 'window no longer exists' }

  $rect = New-Object RECT
  [void][PilotNative]::GetWindowRect($hwnd, [ref]$rect)
  # Not $pid: that is a read-only automatic variable and assigning to it throws.
  $procId = 0
  [void][PilotNative]::GetWindowThreadProcessId($hwnd, [ref]$procId)

  $processName = ''
  try { $processName = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $processName = '' }

  return [pscustomobject]@{
    handle  = [long]$hwnd
    title   = [PilotNative]::WindowTitle($hwnd)
    process = $processName
    pid     = [int]$procId
    x       = $rect.Left
    y       = $rect.Top
    w       = $rect.Right - $rect.Left
    h       = $rect.Bottom - $rect.Top
  }
}

function Get-TopLevelWindows {
  $result = New-Object System.Collections.ArrayList
  foreach ($proc in Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle }) {
    [void]$result.Add([pscustomobject]@{
      handle  = [long]$proc.MainWindowHandle
      title   = $proc.MainWindowTitle
      process = $proc.ProcessName
      pid     = $proc.Id
    })
  }
  return [pscustomobject]@{ windows = @($result) }
}

# The deepest element under the cursor is usually the label inside a control,
# not the control. Walking up to the nearest named, actionable ancestor is what
# makes "click Save" record as the button rather than the word on it.
$ACTIONABLE = 'Button', 'SplitButton', 'MenuItem', 'ListItem', 'TreeItem', 'TabItem',
              'Hyperlink', 'CheckBox', 'RadioButton', 'Edit', 'ComboBox', 'Document'

function Convert-Element($el, $nameOverride) {
  if ($null -eq $el) { return $null }
  $rect = $el.Current.BoundingRectangle
  $type = [string]$el.Current.ControlType.ProgrammaticName
  if ($type.StartsWith('ControlType.')) { $type = $type.Substring(12) }
  return [pscustomobject]@{
    name    = if ($nameOverride) { $nameOverride } else { [string]$el.Current.Name }
    role    = $type
    id      = [string]$el.Current.AutomationId
    cls     = [string]$el.Current.ClassName
    help    = [string]$el.Current.HelpText
    enabled = [bool]$el.Current.IsEnabled
    x       = [int]$rect.X
    y       = [int]$rect.Y
    w       = [int]$rect.Width
    h       = [int]$rect.Height
  }
}

function Get-ElementAt {
  param([int]$X, [int]$Y)

  $point = New-Object System.Windows.Point($X, $Y)
  $el = [System.Windows.Automation.AutomationElement]::FromPoint($point)
  if ($null -eq $el) { throw 'nothing addressable under that point' }

  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $chosen = $el
  $node = $el
  for ($depth = 0; $depth -lt 4 -and $null -ne $node; $depth++) {
    $type = [string]$node.Current.ControlType.ProgrammaticName
    if ($type.StartsWith('ControlType.')) { $type = $type.Substring(12) }
    $named = -not [string]::IsNullOrWhiteSpace([string]$node.Current.Name)
    if ($named -and ($ACTIONABLE -contains $type)) { $chosen = $node; break }
    # Remember the first named ancestor as a fallback for controls whose type
    # is something bespoke that is not in the list above.
    if ($named -and [string]::IsNullOrWhiteSpace([string]$chosen.Current.Name)) { $chosen = $node }
    try { $node = $walker.GetParent($node) } catch { break }
  }

  $at = New-Object POINT
  $at.X = $X
  $at.Y = $Y
  $hwnd = [PilotNative]::WindowFromPoint($at)
  $top = [PilotNative]::GetAncestor($hwnd, 2)  # GA_ROOT

  return [pscustomobject]@{
    element = Convert-Element $chosen $null
    deepest = Convert-Element $el $null
    window  = Get-WindowInfo -Handle ([long]$top)
  }
}

# Recording without a keyboard hook.
#
# GetAsyncKeyState's low bit reports "pressed since you last asked", so polling
# it catches a click without installing a global hook - and deliberately
# without touching the keyboard. Recording clicks is enough to replay a
# workflow; logging every keystroke the user types anywhere on the machine is a
# far larger privacy surface than this feature needs, so typed steps are added
# by hand in the Pilot panel instead.
$script:LastClickAt = [DateTime]::MinValue

function Get-InputEvents {
  $events = New-Object System.Collections.ArrayList

  foreach ($button in @(@{ vk = 0x01; name = 'left' }, @{ vk = 0x02; name = 'right' })) {
    $state = [PilotNative]::GetAsyncKeyState($button.vk)
    if (($state -band 0x0001) -eq 0) { continue }

    $p = New-Object POINT
    [void][PilotNative]::GetCursorPos([ref]$p)

    $now = [DateTime]::UtcNow
    $doubleClick = ($now - $script:LastClickAt).TotalMilliseconds -lt 400
    $script:LastClickAt = $now

    $hit = $null
    try { $hit = Get-ElementAt -X $p.X -Y $p.Y } catch { $hit = $null }

    [void]$events.Add([pscustomobject]@{
      type    = 'click'
      button  = $button.name
      double  = $doubleClick
      x       = $p.X
      y       = $p.Y
      element = if ($hit) { $hit.element } else { $null }
      window  = if ($hit) { $hit.window } else { $null }
    })
  }

  return [pscustomobject]@{ events = @($events) }
}

# Windows refuses SetForegroundWindow from a process that does not own the
# foreground. Attaching to the foreground thread's input queue is the standard
# way round it; if it still fails we say so rather than clicking blind.
function Set-WindowFocus {
  param([long]$Handle)

  $hwnd = [IntPtr]$Handle
  if (-not [PilotNative]::IsWindow($hwnd)) { throw 'window no longer exists' }
  if ([PilotNative]::IsIconic($hwnd)) { [void][PilotNative]::ShowWindow($hwnd, 9) }  # SW_RESTORE

  $foreground = [PilotNative]::GetForegroundWindow()
  $targetPid = 0
  $sourcePid = 0
  $targetThread = [PilotNative]::GetWindowThreadProcessId($hwnd, [ref]$targetPid)
  $sourceThread = [PilotNative]::GetWindowThreadProcessId($foreground, [ref]$sourcePid)

  $attached = $false
  if ($targetThread -ne $sourceThread) {
    $attached = [PilotNative]::AttachThreadInput($sourceThread, $targetThread, $true)
  }
  $ok = [PilotNative]::SetForegroundWindow($hwnd)
  if ($attached) { [void][PilotNative]::AttachThreadInput($sourceThread, $targetThread, $false) }

  if (-not $ok) { throw 'the OS refused to bring that window to the front' }
  return [pscustomobject]@{ focused = $true }
}

# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

$BUTTONS = @{
  left   = @([PilotNative]::MOUSEEVENTF_LEFTDOWN,   [PilotNative]::MOUSEEVENTF_LEFTUP)
  right  = @([PilotNative]::MOUSEEVENTF_RIGHTDOWN,  [PilotNative]::MOUSEEVENTF_RIGHTUP)
  middle = @([PilotNative]::MOUSEEVENTF_MIDDLEDOWN, [PilotNative]::MOUSEEVENTF_MIDDLEUP)
}

function Invoke-Click {
  param([int]$X, [int]$Y, [string]$Button = 'left', [bool]$Double = $false)

  if (-not $BUTTONS.ContainsKey($Button)) { throw "unknown mouse button: $Button" }
  $flags = $BUTTONS[$Button]

  [PilotNative]::MoveMouse($X, $Y)
  # A short settle lets hover states and tooltips resolve before the press;
  # without it some controls swallow the first click.
  Start-Sleep -Milliseconds 30
  [PilotNative]::MouseButton($flags[0], $flags[1])
  if ($Double) {
    Start-Sleep -Milliseconds 40
    [PilotNative]::MouseButton($flags[0], $flags[1])
  }

  $p = New-Object POINT
  [void][PilotNative]::GetCursorPos([ref]$p)
  return [pscustomobject]@{ x = $p.X; y = $p.Y }
}

function Invoke-Type {
  param([string]$Text, [int]$ChunkDelayMs = 0)

  if ([string]::IsNullOrEmpty($Text)) { return [pscustomobject]@{ typed = 0 } }

  # Very long strings sent as one SendInput batch get dropped by some apps, so
  # they go out in chunks with an optional delay for laggy targets.
  $chunk = 40
  for ($i = 0; $i -lt $Text.Length; $i += $chunk) {
    $len = [Math]::Min($chunk, $Text.Length - $i)
    [PilotNative]::TypeUnicode($Text.Substring($i, $len))
    if ($ChunkDelayMs -gt 0) { Start-Sleep -Milliseconds $ChunkDelayMs }
  }
  return [pscustomobject]@{ typed = $Text.Length }
}

# Chords and named keys use SendKeys, which understands "^s" and "{ENTER}".
# Literal text never comes through here - it goes to Invoke-Type, so the
# caller never has to escape a brace or a plus sign.
function Invoke-Key {
  param([string]$Keys)

  if ([string]::IsNullOrEmpty($Keys)) { throw 'no keys given' }
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  return [pscustomobject]@{ sent = $Keys }
}

function Invoke-Scroll {
  param([int]$Amount = -3)
  [PilotNative]::Wheel($Amount * 120)
  return [pscustomobject]@{ scrolled = $Amount }
}

# ---------------------------------------------------------------------------
# Request loop
# ---------------------------------------------------------------------------

function Write-Response($payload) {
  # Depth 6 covers the element list; -Compress keeps one response on one line,
  # which is what the Node side's line splitter expects.
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 6 -Compress))
  [Console]::Out.Flush()
}

Write-Response ([pscustomobject]@{ id = 0; ok = $true; data = [pscustomobject]@{ ready = $true } })

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }

  $id = 0
  try {
    $req = $line | ConvertFrom-Json
    $id = if ($null -ne $req.id) { $req.id } else { 0 }

    $data = switch ($req.op) {
      'ping'       { [pscustomobject]@{ pong = $true } }
      'foreground' { Get-WindowInfo -Handle ([long]0) }
      'window'     { Get-WindowInfo -Handle ([long]$req.handle) }
      'windows'    { Get-TopLevelWindows }
      'tree'       { Get-UiElements -Handle ([long]$req.handle) -MaxNodes ([int]$(if ($req.maxNodes) { $req.maxNodes } else { 400 })) }
      'at'         { Get-ElementAt -X ([int]$req.x) -Y ([int]$req.y) }
      'poll'       { Get-InputEvents }
      'focus'      { Set-WindowFocus -Handle ([long]$req.handle) }
      'click'      { Invoke-Click -X ([int]$req.x) -Y ([int]$req.y) -Button ([string]$(if ($req.button) { $req.button } else { 'left' })) -Double ([bool]$req.double) }
      'type'       { Invoke-Type -Text ([string]$req.text) -ChunkDelayMs ([int]$req.chunkDelayMs) }
      'key'        { Invoke-Key -Keys ([string]$req.keys) }
      'scroll'     { Invoke-Scroll -Amount ([int]$(if ($null -ne $req.amount) { $req.amount } else { -3 })) }
      'cursor'     {
        $p = New-Object POINT
        [void][PilotNative]::GetCursorPos([ref]$p)
        [pscustomobject]@{ x = $p.X; y = $p.Y }
      }
      default      { throw "unknown op: $($req.op)" }
    }

    Write-Response ([pscustomobject]@{ id = $id; ok = $true; data = $data })
  } catch {
    Write-Response ([pscustomobject]@{ id = $id; ok = $false; error = $_.Exception.Message })
  }
}
