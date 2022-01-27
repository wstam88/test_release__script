/* eslint-disable */
import 'zx/globals'
import inquirer from 'inquirer'
import semverInc from 'semver/functions/inc.js'

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));


/**
 * Set options for zx.
 */
$.verbose = false
$.debug = false

const releaseBranch = 'master'
const { log } = console

/**
 * Ask some questions about the release
 */
const { releaseType } = await inquirer.prompt([
  {
    type: 'list',
    name: 'releaseType',
    message: 'Which release type?',
    choices: ['patch', 'minor'],
    required: true,
  },
  {
    type: 'autocomplete',
    name: 'releaseBranch',
    message: 'Which branch to release?',
    source: await $`git branch -r`
  }
])

const previousReleasedVersion = (
  await $`git describe --tags $(git rev-list --tags --max-count=1) | sed -r 's/Release-//g'`
).stdout.trim()

const previousReleaseName = `Release-${previousReleasedVersion}`
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const nextVersion = semverInc(previousReleasedVersion, releaseType)
const tagName = `Release-${nextVersion}`
const tagMessage = `FEA-${nextVersion}`

/**
 * Fetch all tags from the remote in addition to whatever else would otherwise be fetched.
 */
await $`git fetch --quiet --tags origin ${releaseBranch}`

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

log(`Previous released version: ${chalk.green(previousReleaseName)}`)
log(`New release version: ${chalk.green(tagName)}\n`)

/**
 * Make a release of the project.
 */
async function makeRelease() {
  const { proceed } = await inquirer.prompt({
    type: 'list',
    name: 'proceed',
    message: `Are you sure you want to release ${tagName}?`,
    choices: ['yes', 'no'],
  })

  if (proceed === 'no') {
    exitWithError('Aborting release.')
  }

  await $`git pull origin ${releaseBranch}`

  if ((await $`git tag -l --points-at HEAD`).stdout) {
    exitWithError('There is already a tag on this commit. Skipping...')
  }

  setPackageVersion(nextVersion)

  await $`git add package.json`
  await $`git commit -m "${tagName}"`
  log(`Bumped project version in package.json to ${chalk.green(nextVersion)}.`)

  // Tag the current commit.
  log(`Add git tag ${chalk.green(tagName)} with message: ${chalk.green(tagMessage)}`)
  await $`git tag -a ${tagName} -m "${tagMessage}"`

  // Push the commit and the tag to the remote.
  log(`Push the commit and tag to origin ${chalk.green(releaseBranch)}\n`)
  await $`git push --atomic origin ${releaseBranch} ${tagName}`

  log(`🚀 Release ${chalk.green(tagName)} successfully created.`)
}

/**
 * Update the package.json version number to the new one...
 */
function setPackageVersion(version) {
  const packageInfo = require('./package.json')
  packageInfo.version = version
  fs.writeFileSync('./package.json', JSON.stringify(packageInfo, null, 2))
}

/**
 * Exit with an error.
 */
function exitWithError(errorMessage) {
  console.error(chalk.red(errorMessage))
  process.exit(1)
}

/**
 * Run the release.
 */
makeRelease()