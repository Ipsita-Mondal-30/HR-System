module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
      },
    ],
  ],
  plugins: [
    ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
  ],
};
