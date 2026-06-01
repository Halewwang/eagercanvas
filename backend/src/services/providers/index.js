import { Dashboard302ProviderAdapter } from './dashboard302.adapter.js'
import { Dashboard302VideoProviderAdapter } from './dashboard302-video.adapter.js'
import { DerouterProviderAdapter } from './derouter.adapter.js'
import { OpenAiProviderAdapter } from './openai.adapter.js'
import { PhotoRoomProviderAdapter } from './photoroom.adapter.js'
import { SeedanceProviderAdapter } from './seedance.adapter.js'

export const providerAdapters = {
  dashboard302: new Dashboard302ProviderAdapter(),
  'dashboard302-video': new Dashboard302VideoProviderAdapter(),
  derouter: new DerouterProviderAdapter(),
  openai: new OpenAiProviderAdapter(),
  photoroom: new PhotoRoomProviderAdapter(),
  seedance: new SeedanceProviderAdapter()
}

export const getProviderAdapter = (key) => {
  const normalized = String(key || '').trim().toLowerCase()
  return providerAdapters[normalized] || null
}

export {
  Dashboard302ProviderAdapter,
  Dashboard302VideoProviderAdapter,
  DerouterProviderAdapter,
  OpenAiProviderAdapter,
  PhotoRoomProviderAdapter,
  SeedanceProviderAdapter
}
