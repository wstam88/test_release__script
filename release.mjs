#!/usr/bin/env zx

/* eslint-disable */
import 'zx/globals'
import inquirer from 'inquirer'
import semverInc from 'semver/functions/inc.js'

const packageInfo = require('./package.json')

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

/**
 * 
 */
const revList = await $`git rev-list --tags --max-count=1`
const lastReleasedVersion = (
  await $`git describe --tags ${revList} | sed -r 's/Release-//g'`
).stdout.trim()
const currentPackageVersion = packageInfo.version

const releaseBranch = 'master'
const currentRelease = `Release-${lastReleasedVersion}`
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const nextVersion = semverInc(lastReleasedVersion, release_type)
const tagName = `Release-${nextVersion}`
const tagMessage = `FEA-${nextVersion}`

const log = console.log


/**
 * Fetch all tags from the remote in addition to whatever else would otherwise be fetched.
 */
 await $`git fetch --quiet --tags origin`

/**
 * Make sure we are on the release branch.
 */
if (currentBranch !== releaseBranch) {
  log(`You are not on the ${releaseBranch} branch. Please switch to the ${releaseBranch} branch before continuing.`)
    process.exit(1)
}

/**
 * There should be no uncommitted changes.
 */
if ((await $`git status -s`).stdout.trim()) {
  log('There are uncommitted changes. Please commit or stash them before continuing.')
    process.exit(1)
}

/**
 * There should be no unpushed changes.
 */
if ((await $`git diff FETCH_HEAD`).stdout.trim()) {
  log('Local repository contains unpushed commits, abort the release.')
    process.exit(1)
}

log(`Previous released version: ${currentRelease}\n`)
log(`Tag name: ${tagName}`)
log(`Tag message: ${tagMessage}\n`)

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
    log('There is already a tag on this commit. Skipping...')
    process.exit(1)
  } else {
    /**
     * Tag the current commit.
     */
    log(`Add git tag ${tagName} with message: ${tagMessage}`)
    await $`git tag -a ${tagName} -m "${tagMessage}"`

    /**
     * Push the commit and the tag to the remote.
     */
    log(`Push commit and the ${tagName} tag to origin ${releaseBranch}`)
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
 * Run the release.
 */
makeRelease()