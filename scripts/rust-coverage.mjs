import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIN_COVERAGE_THRESHOLD = 80;
const rootDir = resolve(import.meta.dirname, '..');
const crateDir = join(rootDir, 'src-tauri', 'crates', 'scholarium-core');
const manifestPath = join(crateDir, 'Cargo.toml');
const coverageDir = join(rootDir, 'coverage');
const profrawDir = join(coverageDir, 'profraw');
const profdataPath = join(coverageDir, 'scholarium-core.profdata');
const rustLcovPath = join(coverageDir, 'rust-lcov.info');
const tsLcovPath = join(coverageDir, 'lcov.info');

rmSync(profrawDir, { recursive: true, force: true });
mkdirSync(profrawDir, { recursive: true });

const targetLibDir = execFileSync('rustc', ['--print', 'target-libdir'], {
  encoding: 'utf8',
}).trim();
const llvmBinDir = resolve(targetLibDir, '..', 'bin');
const llvmProfdata = join(llvmBinDir, 'llvm-profdata');
const llvmCov = join(llvmBinDir, 'llvm-cov');

const testRun = spawnSync(
  'cargo',
  ['test', '--manifest-path', manifestPath, '--message-format=json'],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      RUSTFLAGS: '-C instrument-coverage',
      LLVM_PROFILE_FILE: join(profrawDir, 'scholarium-core-%p-%m.profraw'),
    },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  }
);

if (testRun.status !== 0) {
  process.exit(testRun.status ?? 1);
}

const executables = [];
for (const line of testRun.stdout.split('\n')) {
  if (!line.trim().startsWith('{')) {
    continue;
  }
  try {
    const msg = JSON.parse(line);
    if (msg.reason === 'compiler-artifact' && msg.executable && msg.profile?.test) {
      executables.push(msg.executable);
    }
  } catch {
    // Ignore non-JSON lines
  }
}

const profrawFiles = readdirSync(profrawDir)
  .filter((name) => name.endsWith('.profraw'))
  .map((name) => join(profrawDir, name));

execFileSync(llvmProfdata, ['merge', '-sparse', ...profrawFiles, '-o', profdataPath], {
  stdio: 'inherit',
});

const objectArgs = executables.flatMap((exe, index) => (index === 0 ? [exe] : ['--object', exe]));
const srcDir = join(crateDir, 'src');

console.log('\n % Rust Coverage report from llvm-cov (scholarium-core)');
execFileSync(llvmCov, ['report', ...objectArgs, `--instr-profile=${profdataPath}`, srcDir], {
  stdio: 'inherit',
});

const lcovOutput = execFileSync(
  llvmCov,
  ['export', '--format=lcov', ...objectArgs, `--instr-profile=${profdataPath}`, srcDir],
  { encoding: 'utf8' }
);

writeFileSync(rustLcovPath, lcovOutput, 'utf8');

if (existsSync(tsLcovPath)) {
  const existingLcov = readFileSync(tsLcovPath, 'utf8');
  if (!existingLcov.includes('src-tauri/crates/scholarium-core')) {
    writeFileSync(tsLcovPath, `${existingLcov.trimEnd()}\n${lcovOutput}`, 'utf8');
  }
} else {
  writeFileSync(tsLcovPath, lcovOutput, 'utf8');
}

const summaryJsonRaw = execFileSync(
  llvmCov,
  ['export', '--summary-only', ...objectArgs, `--instr-profile=${profdataPath}`, srcDir],
  { encoding: 'utf8' }
);

const summary = JSON.parse(summaryJsonRaw);
const totals = summary.data?.[0]?.totals;
const linesPct = totals?.lines?.percent ?? 0;
const functionsPct = totals?.functions?.percent ?? 0;
const regionsPct = totals?.regions?.percent ?? 0;

console.log(
  `\nRust Coverage Summary: Lines ${linesPct.toFixed(2)}% | Functions ${functionsPct.toFixed(2)}% | Regions ${regionsPct.toFixed(2)}% (Threshold: >= ${MIN_COVERAGE_THRESHOLD}%)`
);

if (
  linesPct < MIN_COVERAGE_THRESHOLD ||
  functionsPct < MIN_COVERAGE_THRESHOLD ||
  regionsPct < MIN_COVERAGE_THRESHOLD
) {
  console.error(`ERROR: Rust coverage is below the required ${MIN_COVERAGE_THRESHOLD}% threshold.`);
  process.exit(1);
}
