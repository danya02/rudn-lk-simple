dev:
	npx quasar dev

dev-mobile:
	npx quasar dev -m cordova -T android

build-mobile:
	npx quasar build -m cordova -T android

# prepare-release: build-mobile
# 	/home/danya/Android/Sdk/build-tools/36.0.0/zipalign -v 4 ./dist/cordova/android/bundle/release/app-release.aab ./dist/cordova/android/bundle/release/app-release-aligned.aab
# 	/home/danya/Android/Sdk/build-tools/36.0.0/apksigner sign --ks ../../private/rudn-simple.keystore ./dist/cordova/android/bundle/release/app-release-aligned.aab
