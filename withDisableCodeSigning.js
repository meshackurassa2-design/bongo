const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withDisableCodeSigning(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');
      
      const snippet = `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      config.build_settings['ENTITLEMENTS_REQUIRED'] = 'NO'
    end
  end
`;
      // Inject our snippet right before react_native_post_install
      contents = contents.replace(
        /react_native_post_install\(/g,
        snippet + '  react_native_post_install('
      );
      
      fs.writeFileSync(file, contents);
      return config;
    },
  ]);
};
