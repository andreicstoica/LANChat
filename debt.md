# Tech Debt I've Come Across

# README.md / General Setup

- no clear instruction to start local Honcho containerized server before running the demo (following instructions just gets you a connection error)
- different env.example vs env.template -> template is the proper one to follow because it mentions a honcho base url
- found some API key errors trying to hit the Honcho server upon start (missing in server's `index.ts` file and commented out in the `agent.ts` file)
