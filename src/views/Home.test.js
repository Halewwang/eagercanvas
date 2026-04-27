import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const homeSource = readFileSync(new URL('./Home.vue', import.meta.url), 'utf8')

test('home module tabs fill all three overview columns', () => {
  const tabMatches = homeSource.match(/class="home-tab home-tab-[^"]+"/g) ?? []

  assert.equal(tabMatches.length, 3)
  assert.match(homeSource, /<span>Image<\/span>/)
  assert.match(homeSource, /<span>Video<\/span>/)
  assert.match(homeSource, /<span>3D<\/span>/)
})

test('home page renders the Figma 3D module section', () => {
  assert.match(homeSource, /class="home-module home-module-3d"/)
  assert.match(homeSource, /3D Module/)
  assert.match(homeSource, /Text and views into/)
  assert.match(homeSource, /3D assets/)
})

test('home module icons use Figma-exported colored assets', () => {
  assert.match(homeSource, /tab-image-icon\.svg/)
  assert.match(homeSource, /tab-video-icon\.svg/)
  assert.match(homeSource, /module-image-model-icon\.svg/)
  assert.match(homeSource, /module-video-model-icon\.svg/)
  assert.doesNotMatch(homeSource, /icon-image\.svg/)
  assert.doesNotMatch(homeSource, /icon-video\.svg/)
})
