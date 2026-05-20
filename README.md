# LaunchPad — Better Auth Example

![LaunchPad](./LaunchPad.jpg)

> **This is an experimental fork of [strapi/LaunchPad](https://github.com/strapi/LaunchPad) that replaces `@strapi/plugin-users-permissions` with the community Better Auth stack** (`@strapi-community/plugin-better-auth` + `plugin-api-permissions` + `plugin-better-auth-dashboard`).
>
> Not officially supported. All three Better Auth plugins are still pre-release. Use it as a playground for evaluating Better Auth with Strapi v5 + Next.js — not in production.
>
> **Companion docs in this repo:**
> - [`BETTER-AUTH-BLOG-POST.md`](./BETTER-AUTH-BLOG-POST.md) — Step-by-step tutorial walking from `strapi/LaunchPad@main` to the state of this repo
> - [`BETTER-AUTH-SETUP.md`](./BETTER-AUTH-SETUP.md) — Concise reference guide
>
> **Claude Code skill:** [`.claude/skills/better-auth-setup/`](./.claude/skills/better-auth-setup/SKILL.md) — drives the entire setup automatically against your own Strapi + Next.js project. Clone this repo, open it in Claude Code, and ask *"set up better auth on this strapi and next.js project"*.
>
> Original LaunchPad README continues below.

---

Welcome aboard **LaunchPad**, the official Strapi demo application, where we launch your content into the stratosphere at the speed of _"we-can't-even-measure-it!"_.
This repository contains the following:

- A Strapi project with content-types and data already onboard
- A Next.js client that's primed and ready to fetch the content from Strapi faster than you can say "blast off!"

## 🌌 Get started

Strap yourself in! You can get started with this project on your local machine by following the instructions below, or you can [request a private instance on our website](https://strapi.io/demo)

### Prerequisites

- **Node.js** v18 or higher
- **Yarn** as your package manager (this project uses Yarn internally for its scripts)

> **Don't have Yarn installed?** You can enable it via Node.js Corepack:
> ```sh
> corepack enable
> ```
> Or install it globally via npm:
> ```sh
> npm install -g yarn
> ```

## 1. Clone and Install

To infinity and beyond! Clone the repo and install root dependencies:

```sh
git clone https://github.com/strapi/launchpad.git
cd launchpad
yarn install
```

## 2. Setup

Run the setup script to install dependencies in both projects (Strapi and Next.js) and copy the environment files:

```sh
yarn setup
```

## 3. Seed the Data

Populate your Strapi instance with demo content:

```sh
yarn seed
```

## 4. Start the Development Servers

Launch both Strapi and Next.js concurrently from the root:

```sh
yarn dev
```

This starts the Strapi server first, waits for it to be ready, then starts the Next.js frontend. You're now a spacefaring content master!

Visit http://localhost:1337/admin to create your first Strapi user, and http://localhost:3000 to discover your space rocket website.

## Features Overview ✨

### User

<br />

 - **An intuitive, minimal editor** The editor allows you to pull in dynamic blocks of content. It’s 100% open-source, and it’s fully extensible.<br />
 - **Media Library** Upload images, video or any files and crop and optimize their sizes, without quality loss.<br />
 - **Flexible content management** Build any type of category, section, format or flow to adapt to your needs. <br />
 - **Sort and Filter** Built-in sorting and filtering: you can manage thousands of entries without effort.<br />
 - **User-friendly interface** The most user-friendly open-source interface on the market.<br />
 - **SEO optimized** Easily manage your SEO metadata with a repeatable field and use our Media Library to add captions, notes, and custom filenames to optimize the SEO of media assets.<br /><br />

### Global

<br />

 - [Customizable API](https://strapi.io/features/customizable-api): Automatically build out the schema, models, controllers for your API from the editor. Get REST or GraphQL API out of the box without writing a single line of code.<br />
 - [Media Library](https://strapi.io/features/media-library): The media library allows you to store your images, videos and files in your Strapi admin panel with many ways to visualize and manage them.<br />
 - [Role-Based Access Control (RBAC)](https://strapi.io/features/custom-roles-and-permissions): Role-Based Access Control is a feature available in the Administration Panel settings that let your team members have access rights only to the information they need.<br />
 - [Internationalization (i18n)](https://strapi.io/features/internationalization): Internationalization (i18n) lets you create many content versions, also called locales, in different languages and for different countries.<br />
 - [Audit Logs](https://strapi.io/blog/reasons-and-best-practices-for-using-audit-logs-in-your-application): The Audit Logs section provides a searchable and filterable display of all activities performed by users of the Strapi application<br />
 - [Data transfer](https://strapi.io/blog/importing-exporting-and-transferring-data-with-the-strapi-cli): Streams your data from one Strapi instance to another Strapi instance.<br />
 - [Review Worfklows](https://docs.strapi.io/user-docs/settings/review-workflows): Create and manage any desired review stages for your content, enabling your team to collaborate in the content creation flow from draft to publication. <br />

## Resources

[Docs](https://docs.strapi.io) • [Discord](https://discord.strapi.io) • [YouTube](https://www.youtube.com/c/Strapi/featured) • [Strapi Design System](https://design-system.strapi.io/) • [Marketplace](https://market.strapi.io/) • [Cloud Free Trial](https://cloud.strapi.io)

## Customization

- The Strapi application contains a custom population middlewares in every api route.

- The Strapi application contains a postinstall script that will regenerate an uuid for the project in order to get some anonymous usage information concerning this demo. You can disable it by removing the uuid inside the `./strapi/packages.json` file.

- The Strapi application contains a patch for the @strapi/admin package. It is only necessary for the hosted demos since we automatically create the Super Admin users for them when they request this demo on our website.
