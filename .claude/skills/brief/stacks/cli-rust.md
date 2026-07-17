# Stack Recipe: cli-rust

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: macOS + Windows + Linux (binarios nativos)

## KEEP
- Ninguno del stack web.

## ADD
- **Rust 1.80+** (toolchain via `rustup`)
- **clap** ^4 con feature `derive` (parser de args, standard de facto)
- **anyhow** (error handling en binarios)
- **thiserror** (error types en libs reutilizables)
- **serde** + **serde_json** / **toml** (serializacion)
- **indicatif** (progress bars / spinners)
- **dialoguer** (prompts interactivos)
- **colored** o **ansi_term** (colores)
- **tokio** (async runtime si hay I/O concurrente)
- **reqwest** (HTTP client si aplica)
- Opcional: **cargo-dist** (releases multi-plataforma con binarios)

## REPLACE
- Todo el stack web.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind configs, `next.config.ts`

## CONFIG
- `Cargo.toml` (deps + `[[bin]]` si multi-binary)
- `rustfmt.toml` (formato consistente)
- `.cargo/config.toml` (targets, linkers — opcional)
- Tests con `#[test]` + `cargo test`
- Cross-compilation:
  - `cross` (docker-based cross build)
  - `cargo-zigbuild` (linker universal con zig)
- Releases: **cargo-dist** (genera tarballs + installers + Homebrew formula)

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind configs

## Archivos nuevos a crear
- `src/main.rs`
- `src/cli.rs` (clap Parser)
- `src/commands/*.rs` (uno por subcomando)
- `Cargo.toml`
- `.github/workflows/release.yml` (si cargo-dist)

## IDE / Toolchain externo requerido
- **Rust toolchain** (`rustup`, `cargo`)
- **VS Code** con `rust-analyzer` o **RustRover**
- Cuenta **crates.io** (publicar: `cargo publish`)
- Opcional: cuenta **Homebrew tap** para `brew install`
