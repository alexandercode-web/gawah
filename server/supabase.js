import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env')
  process.exit(1)
}

import ws from 'ws'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: fetch,
    headers: { 'x-my-custom-header': 'gawah' }
  },
  realtime: {
    transport: ws
  }
})

// Ensure 'uploads' bucket exists
supabase.storage.listBuckets().then(({ data: buckets }) => {
  if (buckets && !buckets.find(b => b.name === 'uploads')) {
    supabase.storage.createBucket('uploads', { public: true })
      .then(() => console.log('Created public Supabase storage bucket: uploads'))
      .catch(err => console.error('Failed to create uploads bucket:', err))
  }
}).catch(console.error)
