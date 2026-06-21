# Building the Letter Ride Android APK

The game is a static web app wrapped by Capacitor. These steps run on **your Mac**
(the AI build agent scaffolded the config but cannot run the native toolchain).

## Prerequisites (one-time)
- **JDK 17** (`brew install openjdk@17`)
- **Android Studio** (includes the Android SDK + an emulator). Open it once and let it install the SDK.
- A physical Android phone with **USB debugging** on, or an emulator (AVD) created in Android Studio.

## First build
```bash
npm install                 # installs Capacitor (one time)
npm run cap:copy            # assembles www/ from index.html + src/ + assets/
npx cap add android         # one-time: generates the android/ native project
npm run cap:sync            # copies www/ into the native project (re-run after any code change)
npx cap open android        # opens Android Studio
```
In Android Studio: select your device/emulator and press **Run** (▶). The app installs and launches.

## APK file (without Android Studio)
```bash
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
# install on a connected device: adb install app/build/outputs/apk/debug/app-debug.apk
```

## After changing game code
```bash
npm run cap:sync            # re-copies www/ into android/, then `npx cap open android` + Run
```

## Notes
- `localStorage` persists in the WebView, so your in-progress run (`letterRide.run`) and
  meta-progression (`letterRide.meta`) survive app restarts — same as the web version.
- The ~2 MB ENABLE dictionary is bundled in the APK (it's in `www/assets/`).
- `www/` and `android/` are git-ignored (generated). Only the config + scripts are committed.
