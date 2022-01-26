#!/usr/bin/env zx

/* eslint-disable */
import 'zx/globals'
import inquirer from 'inquirer'
import semverInc from 'semver/functions/inc.js'

const packageInfo = require('./package.json')
const log = console.log

/**
 * Set options for zx.
 */
$.verbose = false


/**
 * Ask some questions about the release
 */
const { release_type } = await inquirer.prompt([
  {
    type: 'list',
    name: 'release_type',
    message: 'Which release type?',
    choices: ['patch', 'minor'],
    required: true,
  },
])


const lastReleasedVersion = (
  await $`git describe --tags $(git rev-list --tags --max-count=1) | sed -r 's/Release-//g'`
).stdout.trim()

const releaseBranch = 'master'
const currentRelease = `Release-${lastReleasedVersion}`
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const nextVersion = semverInc(lastReleasedVersion, release_type)
const tagName = `Release-${nextVersion}`
const tagMessage = `FEA-${nextVersion}`



/**
 * Fetch all tags from the remote in addition to whatever else would otherwise be fetched.
 */
 await $`git fetch --quiet --tags origin`

/**
 * Make sure we are on the release branch.
 */
if (currentBranch !== releaseBranch) {
  exitWithError(`Please switch to the ${releaseBranch} branch before continuing.`)
}

/**
 * There should be no uncommitted changes.
 */
if ((await $`git status -s`).stdout.trim()) {
  exitWithError('There are uncommitted changes. Please commit or stash them before continuing.')
}

/**
 * There should be no unpushed changes.
 */
if ((await $`git diff FETCH_HEAD`).stdout.trim()) {
  exitWithError('Local repository contains unpushed commits, abort the release.')
}

log(`Previous released version: ${currentRelease}\n`)
log(`New release version: ${tagName}`)

/**
 * Make a release of the project.
 */
async function makeRelease() {
  await $`git checkout ${releaseBranch}`
  await $`git pull origin ${releaseBranch}`

  setPackageVersion(nextVersion)

  await $`git add package.json`
  await $`git commit -m "${tagName}"`

  const tagOnCurrentCommit = (await $`git tag -l --points-at HEAD`).stdout

  if (tagOnCurrentCommit) {
    exitWithError('There is already a tag on this commit. Skipping...')
  } else {
    /**
     * Tag the current commit.
     */
    log(`Add git tag ${tagName} with message: ${tagMessage}`)
    await $`git tag -a ${tagName} -m "${tagMessage}"`

    /**
     * Push the commit and the tag to the remote.
     */
    log(`Push the commit and the ${tagName} tag to origin ${releaseBranch}`)
    await $`git push --atomic origin ${releaseBranch} ${tagName}`
  }
}

/**
 * Update the package.json version number to the new one...
 */
function setPackageVersion(version) {
  packageInfo.version = version
  fs.writeFileSync('./package.json', JSON.stringify(packageInfo, null, 2))
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
makeRelease()