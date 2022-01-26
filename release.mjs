#!/usr/bin/env zx
/* eslint-disable */
import 'zx/globals'
import inquirer from 'inquirer'
import semverInc from 'semver/functions/inc.js'
import { exit } from 'process'
const packageInfo = require('./package.json')

/**
 * Set options for zx.
 */
$.verbose = false

/**
 * Package.json information
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

await $`git fetch --quiet --tags origin`

const revList = await $`git rev-list --tags --max-count=1`
const lastReleasedVersion = (
  await $`git describe --tags ${revList} | sed -r 's/Release-//g'`
).stdout.trim()
const currentPackageVersion = packageInfo.version

const currentRelease = `Release-${lastReleasedVersion}`
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const nextVersion = semverInc(lastReleasedVersion, release_type)
const tagName = `Release-${nextVersion}`
const tagMessage = `FEA-${nextVersion}`

const log = console.log


log(currentBranch)

/**
 * We should be on the master branch
 * ...of course we could switch to the master branch automaticlly?
 */
if (currentBranch !== 'master') {
  log('You are not on the master branch. Please switch to the master branch before continuing.')
    exit(1)
}

/**
 * There should be no uncommitted changes.
 */
if ((await $`git status -s`).stdout.trim()) {
  log('There are uncommitted changes. Please commit or stash them before continuing.')
    exit(1)
}

/**
 * There should be no uncommitted changes.
 */
if (await 'git diff FETCH_HEAD') {
  log('Local repository contains unpushed commits, abort the release.')
    exit(1)
}

log(`Current version: ${currentRelease}`)
log(`Tag name: ${tagName}`)
log(`Tag message: ${tagMessage}\n`)

/**
 * Make a release of the project.
 */
async function makeRelease() {
  await $`git checkout master`
  await $`git pull origin master`

  setPackageVersion(nextVersion)

  await $`git add package.json`
  await $`git commit -m "${tagName}"`

  const tagOnCurrentCommit = (await $`git tag -l --points-at HEAD`).stdout

  if (tagOnCurrentCommit) {
    log('There is already a tag on this commit. Skipping...')
    exit(1)
  } else {
    // Add git tag
    log(`Add git tag ${tagName} with message: ${tagMessage}`)
    await $`git tag -a ${tagName} -m "${tagMessage}"`

    // Push git tag
    log(`Push the ${tagName} tag to origin`)
    await $`git push origin master`
  }
}

/**
 * Update the package.json version.
 */
function setPackageVersion(version) {
  packageInfo.version = version
  fs.writeFileSync('./package.json', JSON.stringify(packageInfo, null, 2))
}

makeRelease()