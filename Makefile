dev:
	npx quasar dev

dev-mobile:
	npx quasar dev -m cordova -T android

# Debug .apk, for `adb install` onto a test device.
build-mobile:
	npx quasar build -m cordova -T android --debug

# Release .aab, for uploading to the Google Play Console.
#
# No zipalign or apksigner step: Cordova signs and aligns the bundle itself
# during the Gradle build, using the keystore described in
# src-cordova/build.json. That file holds the keystore password, so it is
# gitignored -- copy src-cordova/build.json.example and fill it in.
#
# Remember to bump android-versionCode in src-cordova/config.xml before every
# upload; Play rejects a bundle whose versionCode it has already seen.
build-release:
	@grep -o 'android-versionCode="[0-9]*"' src-cordova/config.xml
	@test -f src-cordova/build.json || \
		{ echo "src-cordova/build.json is missing; copy build.json.example and fill it in."; exit 1; }
	npx quasar build -m cordova -T android
