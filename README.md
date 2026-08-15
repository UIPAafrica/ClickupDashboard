# ClickUp Dashboard

A real-time, fullscreen dashboard for ClickUp projects built with Next.js 14, React Query, and shadcn/ui.

## Features

- **Automatic Refresh**: Refetches on the interval set by `REFRESH_INTERVAL_SECONDS`
  in `src/hooks/use-tasks.ts` (currently 3 hours). The header label is derived
  from that constant, so the two cannot drift apart.
- **Project Overview**: Shows progress, task counters, and weekly metrics
- **Responsive Design**: Adapts to different screen sizes
- **Modern UI**: Built with shadcn/ui and TailwindCSS
- **Error Handling**: Graceful error states and loading indicators

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Data Fetching**: React Query
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- ClickUp API key
- ClickUp Team ID

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd clickup-dashboard
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp env.example .env.local
```

4. Configure your ClickUp credentials in `.env.local`:

```bash
CLICKUP_API_KEY=your_clickup_api_key_here
CLICKUP_TEAM_ID=your_team_id_here
# Optional: space used for the "Active Projects" count
CLICKUP_SPACE_ID=your_space_id_here
```

### Getting ClickUp Credentials

1. **API Key**:

   - Go to ClickUp Settings → Apps
   - Generate a Personal API Token
   - Copy the token (starts with `pk_`)

2. **Team ID**:
   - Go to your ClickUp workspace
   - Check the URL: `https://app.clickup.com/{TEAM_ID}/`
   - Copy the team ID from the URL

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Project Structure

```
src/
├── app/
│   ├── api/tasks/          # API route for ClickUp integration
│   ├── dashboard/          # Dashboard page
│   └── layout.tsx          # Root layout with providers
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── project-tile.tsx    # Project tile component
├── hooks/
│   └── use-tasks.ts        # React Query hook for tasks
├── lib/
│   └── utils.ts            # Utility functions
└── providers/
    └── query-provider.tsx  # React Query provider
```

## API Response Format

The dashboard expects projects in this format:

```json
{
  "projects": [
    {
      "id": "90127590691",
      "name": "Total Chegutu",
      "progress": 65,
      "counters": {
        "inProgress": 5,
        "completed": 12,
        "completedThisWeek": 4,
        "dueThisWeek": 2
      }
    }
  ]
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Make sure to set the environment variables:

- `CLICKUP_API_KEY`
- `CLICKUP_TEAM_ID`
- `CLICKUP_SPACE_ID` (optional)

The server must be able to reach `api.clickup.com` — if outbound egress is
restricted, allowlist that host or the dashboard will report a 403.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
