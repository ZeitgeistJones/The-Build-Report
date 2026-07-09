export type TweetEmbed = {
  html: string
  authorName: string
  authorUrl: string
}

export async function fetchTweetEmbed(tweetUrl: string): Promise<TweetEmbed | null> {
  try {
    const params = new URLSearchParams({ url: tweetUrl, omit_script: 'true' })
    const res = await fetch(`https://publish.twitter.com/oembed?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      html: data.html,
      authorName: data.author_name,
      authorUrl: data.author_url,
    }
  } catch {
    return null
  }
}
