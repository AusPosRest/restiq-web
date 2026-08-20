'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

// The only place an API address appears in this codebase. Set per environment:
// .env.local on the dev machine, a project setting on Vercel.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

type Health = { status: string; service: string }
type DbHealth = { status: string; database: string }

async function readHealth(): Promise<string> {
  try {
    const res = await fetch(`${apiUrl}/health`)
    const data: Health = await res.json()
    return `${data.status} - ${data.service}`
  } catch {
    return 'backend unreachable'
  }
}

async function readDbHealth(): Promise<string> {
  try {
    const res = await fetch(`${apiUrl}/health/db`)
    const data: DbHealth = await res.json()
    return `${data.status} - ${data.database}`
  } catch {
    return 'backend unreachable'
  }
}

export default function Home() {
  const [health, setHealth] = useState('checking...')
  const [dbHealth, setDbHealth] = useState('checking...')

  useEffect(() => {
    let cancelled = false
    void readHealth().then((result) => {
      if (!cancelled) setHealth(result)
    })
    void readDbHealth().then((result) => {
      if (!cancelled) setDbHealth(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Restiq - test page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page exists to prove the pipeline, nothing else: browser to this app,
          from here to the API, and from the API to the database.
        </p>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">API address</dt>
          <dd className="font-mono">{apiUrl || 'not set'}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">API health</dt>
          <dd className="font-mono">{health}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Database</dt>
          <dd className="font-mono">{dbHealth}</dd>
        </div>
      </dl>

      <Button
        className="w-fit"
        onClick={() => {
          void readHealth().then(setHealth)
          void readDbHealth().then(setDbHealth)
        }}
      >
        Check again
      </Button>
    </main>
  )
}
