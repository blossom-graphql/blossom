# Quick Start

## Requirements

To be defined.

## Start a project from scratch

The most common use case when using Blossom is starting a project from scratch. You can start this just like any other Node project:

```bash
mkdir my-blossom-project && cd my-blossom-project
npm init
```

The first thing you need to do is to install the CLI, also known as the **toolbelt**. The Blossom Toolbelt is the most important piece of software in your daily workflows with a Blossom project, since it enables you to start projects from scratch, automatically generate code, build your project, etc.

Since you could be working with Blossom projects that have different versions, we encourage to install the toolbelt locally on your project instead of globally:

```bash
npm install --dev @blossom-gql/toolbelt
```

The toolbelt will now be available by using `npx blossom`:

```bash
npx blossom -v
```

This will give you the Blossom version of your current project, without the need to set up any kind of virtual environment are global install.

To see a list of available commands on the toolbelt:

```bash
npx blossom -h
```

You can create a project from scratch using the **Koa** template by doing:

```bash
npx blossom bootstrap -t koa
```

Once the project is bootstrapped, you can start the development server with an example by running:

```bash
npx blossom server
```

Your project should now be running on [`http://localhost:3000`](http://localhost:3000). Congratulations 🎉! These are the two available URLs:

- [`http://localhost:3000/graphql`](http://localhost:3000/graphql): your GraphQL playground. **Only available when `NODE_ENV` is not set to `production`**.

- (`POST`) [`http://localhost:3000/graphql`](http://localhost:3000/graphql): resolves actual GraphQL requests.

Before starting introducing changes to this project, we encourage you to go to the next sections in order to understand the platform and the core concepts of Blossom.

## Integrate into a existing project

Blossom can also be used on any existing project. A guide for these purposes will be available soon.
