import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.error('[search] FIRECRAWL_API_KEY is not set. Add it to .env.local and restart next dev.');
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY is not configured. Add it to .env.local and restart the server.' },
        { status: 500 }
      );
    }

    // Use Firecrawl search to get top 8 results with screenshots
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: 8,
        scrapeOptions: {
          formats: ['markdown', 'screenshot'],
          onlyMainContent: true,
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text();
      console.error('[search] Firecrawl error:', searchResponse.status, errorBody);
      return NextResponse.json(
        { error: `Firecrawl search failed (${searchResponse.status}): ${errorBody}` },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    
    // Format results with screenshots and markdown
    const results = searchData.data?.map((result: any) => ({
      url: result.url,
      title: result.title || result.url,
      description: result.description || '',
      screenshot: result.screenshot || null,
      markdown: result.markdown || '',
    })) || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}