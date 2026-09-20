/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export -> Electron loads out/index.html directly from disk.
  output: 'export',
  // NOTE: distDir must NOT be 'out'. `output: 'export'` writes the exported
  // site to out/, so pointing the build dir there too makes them collide and
  // no index.html is ever produced.
  distDir: '.next',
  // file:// has no image optimizer.
  images: { unoptimized: true },
  // Relative asset URLs, otherwise /_next/... 404s under file://.
  assetPrefix: './',
  trailingSlash: true,

  webpack: (config) => {
    // The model runtime is bundled separately by scripts/build-workers.js and
    // never reaches this graph. This alias is belt-and-braces: if anything
    // ever does import transformers.js from app code, it must not drag in the
    // native Node bindings, which webpack cannot parse.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

module.exports = nextConfig;
