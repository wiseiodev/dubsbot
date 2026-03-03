## ADDED Requirements

### Requirement: Package metadata supports global CLI installation
The project MUST define npm package metadata that produces a globally installable CLI artifact, including a valid `bin` entry mapping `dubsbot` to the built executable and a supported Node engine range.

#### Scenario: Metadata is valid for global install
- **WHEN** a maintainer inspects the package manifest before release
- **THEN** `bin.dubsbot` points to the built CLI entry file and `engines.node` declares the supported runtime range

### Requirement: Published package contents are intentionally scoped
The publish artifact SHALL include only files required to run the CLI at install time and MUST exclude development-only source and local tooling files.

#### Scenario: Packed artifact includes only runtime assets
- **WHEN** the package is generated via `npm pack`
- **THEN** the tarball contains build output, license/readme, and required runtime assets, and excludes test and local-only development files

### Requirement: Installed CLI executes from packaged artifact
A package installed from the packed tarball MUST execute the `dubsbot` command successfully in a clean environment.

#### Scenario: CLI smoke run succeeds after install
- **WHEN** a release verification step installs the packed artifact into a temporary environment
- **THEN** invoking `dubsbot --help` exits successfully and prints CLI usage output
