22:13:34.549 Running build in Washington, D.C., USA (East) – iad1
22:13:34.551 Build machine configuration: 2 cores, 8 GB
22:13:34.702 Cloning github.com/ZeitgeistJones/The-Build-Report (Branch: main, Commit: a7813e6)
22:13:35.327 Cloning completed: 625.000ms
22:13:36.964 Restored build cache from previous deployment (DerYq6SRdKjjTB5VWi2aREXrRKpU)
22:13:37.311 Running "vercel build"
22:13:37.347 Vercel CLI 54.21.1
22:13:37.951 Installing dependencies...
22:13:39.311 
22:13:39.311 up to date in 1s
22:13:39.312 
22:13:39.313 84 packages are looking for funding
22:13:39.313   run `npm fund` for details
22:13:40.296 Detected Next.js version: 14.2.3
22:13:40.303 Running "npm run build"
22:13:40.463 
22:13:40.463 > the-build-report@0.1.0 build
22:13:40.464 > next build
22:13:40.464 
22:13:41.463   ▲ Next.js 14.2.3
22:13:41.464 
22:13:41.494    Creating an optimized production build ...
22:13:54.021  ✓ Compiled successfully
22:13:54.023    Linting and checking validity of types ...
22:14:08.685 Failed to compile.
22:14:08.686 
22:14:08.687 ./app/page.tsx:40:15
22:14:08.687 Type error: Module '"@/components/RepoList"' has no exported member 'RepoWithLive'. Did you mean to use 'import RepoWithLive from "@/components/RepoList"' instead?
22:14:08.687 
22:14:08.687   38 |   buildShippingLeverageTrendExplanation,
22:14:08.687   39 | } from '@/lib/gradeNarratives'
22:14:08.688 > 40 | import { type RepoWithLive } from '@/components/RepoList'
22:14:08.688      |               ^
22:14:08.688   41 | import HomeRepoSection from '@/components/HomeRepoSection'
22:14:08.688   42 | import GradesPanel from '@/components/GradesPanel'
22:14:08.689   43 | import AllTimeStats from '@/components/AllTimeStats'
22:14:08.901 Error: Command "npm run build" exited with 1
