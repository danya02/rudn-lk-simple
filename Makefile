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

# PWA bundle, into dist/pwa/.
build-pwa:
	npx quasar build -m pwa

# Deploy the PWA to lk.rudn-lab.ru.
#
# published/ is a separate clone of rudn-lab/lk.rudn-lab.ru living inside this
# working tree (gitignored, not a submodule). Its CNAME is not part of the
# Quasar output, so the copy preserves it and deletes everything else.
#
# This pushes to a public site; it stops for confirmation first.
deploy-pwa: build-pwa
	@test -d published/.git || \
		{ echo "published/ is not a clone of rudn-lab/lk.rudn-lab.ru."; exit 1; }
	@test -f published/CNAME || { echo "published/CNAME is missing."; exit 1; }
	rsync -a --delete --exclude .git --exclude CNAME dist/pwa/ published/
	@git -C published status --short
	@printf 'Push the above to lk.rudn-lab.ru? [y/N] ' && read ans && test "$$ans" = y
	git -C published add -A
	git -C published commit -m "Deploy $$(git rev-parse --short HEAD)$$(git diff-index --quiet HEAD -- || echo ' (dirty)')"
	git -C published push
