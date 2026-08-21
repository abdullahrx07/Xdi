# CHANGELOG

All notable changes to this project will be documented in this file.

## [1.2.31] - 2026-08-19
### Fixed
- **Post Reaction**: Fixed `setPostReaction` failing to apply reactions correctly on posts.

## [1.2.30] - 2026-07-25
### Fixed
- **Version Comparison**: Fixed a critical bug in version comparison inside the auto-updater (`checkUpdate.js`) that returned invalid results on non-numeric version suffixes (e.g., `1.2.3-beta.1` vs `1.2.2` returning as equal due to `NaN`).
- **NPM Registry 404 Handling**: Resolved issues where unpublished/local packages caused update check failures and threw crash-worthy errors. Handled NPM registry 404 responses gracefully with user-friendly warnings.
- **Changelog Retrieval URL**: Corrected the raw GitHub repository URL to point directly to the main repository (`https://github.com/abdullahrx07/Maria-fca`) instead of outdated fork sources.

### Added
- **Configurable Auto Update**: Implemented a custom, configurable `autoUpdate` option (`options.autoUpdate = true/false`) during the `login()` sequence, allowing developers to disable automatic library updates and process restarts.
- **Dynamic Package Name Resolution**: Enhanced `checkUpdate` to dynamically resolve the package name from `package.json` rather than hardcoding `'xdi-fca'`, providing complete out-of-the-box support for forks and renamed versions.
- **Section-by-Section Dependency Update**: Upgraded user `package.json` updater to search and replace dependency versions across all sections (`dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`).

## [1.2.29] - 2026-07-20
### Added
- **E2EE Bridge Integration**: Exposed `api.connectE2EE` and `api.getE2EEDeviceData` for seamless and robust native Labyrinth E2EE connection management.
- **Silent Attachment Hosting**: Implemented a multi-provider silent image uploader leveraging ImgBB (fallback to ImageKit) to dynamically host decrypted files.

## [1.2.28] - 2026-07-15
### Fixed
- **Listener Crashes**: Resolved automatic logout, disconnection, and fatal crash loops in the `listenMqtt` protocol listener.
- **Decrypted Media Cache**: Decoupled decrypted media buffers from transient memory, establishing a structured local HTTP caching server on dynamic ports.
