#!/usr/bin/env zx
import 'zx/globals'
import inquirer from 'inquirer'

// const packageJson = JSON.parse(await $`cat ../package.json`)
const answers = await inquirer.prompt([
  {
    type: 'list',
    name: 'next_branch',
    message: 'Which branch do you want to release?',
    choices: ['master', 'next', 'next-dev', 'next-feature', 'next-hotfix', 'next-release'],
  },
  {
    type: 'list',
    name: 'release_type',
    message: 'Which release type?',
    choices: ['patch', 'minor', 'major'],
  },
])

let fix_version = ''
let next_version = ''
let next_branch = ''
let current_branch = ''

/**
 * Make a release of the project.
 */
// function makeRelease() {
//   //   console.log(`Making release ${packageJson.version}`)
//   if (await $`git checkout ${next_branch}`) {
//     console.log(`Switched to ${next_branch}`)
//   } else {
//     await $`git checkout master`
//     await $`git pull origin master`
//     await $`git checkout -B ${$next_branch}`
//     await $`git push -u origin ${next_branch}`
//   }

//   const tag_on_current_commit = await $`git tag -l --points-at HEAD`
// }

// makeRelease()
