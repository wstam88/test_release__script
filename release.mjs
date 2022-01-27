/* eslint-disable */
import "zx/globals";
import inquirer from "inquirer";
import semverInc from "semver/functions/inc.js";

/**
 * Set options for zx.
 */
$.verbose = false;
$.debug = false;

const { log } = console;

let currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim();
const preferedReleaseBranches = ["main", "master", currentBranch];
const branchList = (await $`git branch -r`).stdout
  .split("\n")
  .map((branch) => branch.replace(/\s+|\s+|origin\//g, ""));

/**
 * Get the first prefered release branch that exists.
 */
function getPreferedReleaseBranch() {
  return branchList.find((branch) =>
    preferedReleaseBranches.includes(branch)
  );
}

/**
 * Ask some questions about the release
 */
const { releaseType, releaseBranch } = await inquirer.prompt([
  {
    type: "list",
    name: "releaseType",
    message: "Which release type?",
    choices: ["patch", "minor"],
    required: true,
  },
  {
    type: "list",
    name: "releaseBranch",
    message: "Which branch to release?",
    choices: branchList,
    required: true,
    default: getPreferedReleaseBranch(),
    validate: (branch) => branchList.includes(branch),
  },
]);

const previousReleasedVersion = (
  await $`git describe --tags $(git rev-list --tags --max-count=1) | sed -r 's/Release-//g'`
).stdout.trim();

const previousReleaseName = `Release-${previousReleasedVersion}`;
const nextVersion = semverInc(previousReleasedVersion, releaseType);
const tagName = `Release-${nextVersion}`;
const tagMessage = `FEA-${nextVersion}`;

/**
 * Fetch all tags from the remote in addition to whatever else would otherwise be fetched.
 */
await $`git fetch --quiet --tags origin ${releaseBranch}`;


/**
 * There should be no uncommitted changes.
 */
if ((await $`git status -s`).stdout.trim()) {
  exitWithError(
    "There are uncommitted changes. Please commit or stash them before continuing."
  );
}

/**
 * Make sure we are on the release branch.
 */
 if (currentBranch !== releaseBranch) {
  await $`git checkout ${releaseBranch}`;
  
  currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim();

  if (currentBranch !== releaseBranch) {
    exitWithError(`Could not checkout ${releaseBranch}`);
  }
}

/**
 * There should be no unpushed changes.
 */
if ((await $`git diff FETCH_HEAD`).stdout.trim()) {
  exitWithError(
    "Local repository contains unpushed commits, abort the release."
  );
}

log(`Release branch: ${chalk.green(releaseBranch)}`);
log(`Previous released version: ${chalk.green(previousReleaseName)}`);
log(`New release version: ${chalk.green(tagName)}\n`);

/**
 * Make a release of the project.
 */
async function makeRelease() {
  /**
   * Verify that the user is ready to release.
   */
  const { proceed } = await inquirer.prompt({
    type: "list",
    name: "proceed",
    message: [
      `Are you sure you want to release branch`,
      `${chalk.green(currentBranch)} as ${chalk.green(tagName)}?`,
    ].join(" "),
    choices: ["yes", "no"],
  });

  if (proceed === "no") {
    exitWithError("Aborting release.");
  }

  /**
   * Pull the latest changes from the remote.
   */
  await $`git pull origin ${releaseBranch}`;

  /**
   * Make sure there isn't already a tag created.
   */
  if ((await $`git tag -l --points-at HEAD`).stdout) {
    exitWithError("There is already a tag on this commit. Skipping...");
  }

  /**
   * Bump the version in package.json and package-lock.json and commit them.
   */
  log(`Bump project version in package.json to ${chalk.green(nextVersion)}.`);
  await $`npm --no-git-tag-version version ${nextVersion}`;
  await $`git add package.json package-lock.json`;
  await $`git commit -m "${tagName}"`;

  /**
   * Create a new tag
   */
  log(
    `Add git tag ${chalk.green(tagName)} with message: ${chalk.green(
      tagMessage
    )}`
  );
  await $`git tag -a ${tagName} -m "${tagMessage}"`;

  /**
   * Push the commit and tag to the remote.
   */
  log(`Push the commit and tag to origin ${chalk.green(releaseBranch)}\n`);
  await $`git push --atomic origin ${releaseBranch} ${tagName}`;

  /**
   * Hoeray! Release created successfully.
   */
  log(`🚀 Release ${chalk.green(tagName)} successfully created.`);
}

/**
 * Exit with an error.
 */
function exitWithError(errorMessage) {
  console.error(chalk.red(errorMessage));
  process.exit(1);
}

/**
 * Run the release.
 */
makeRelease();
