Blossom is a TypeScript framework for building GraphQL backends on a simple, systematic and predictable way.

# Blossom Goals

These **are** Blossom goals:

- Be **lightweight** and **unobtrusive**. All the units should be **functions** that can be easily understood on their own. The type system is there to **help** you, not to get in your way.

- Be **developer centric**. Have good documentation, make it easy to use and understand, make your code easy to reason about and understand.

- Don't make any assumption about your data sources. By leveraging the use of **loaders**, you can pull your data from a Mongo database, a SQL database, a RESTful API, a gRPC endpoint, or any combination of them in a single query!

- Be a **systematic** framework. By clearly defining an architecture pattern, your project should be simple to understand, predict and measure.

- But, **avoid being tedious**. Repeating an architecture pattern can be tedious. For this reason, Blossom aims to provide CLI tools that automate many of the most common workflows when building your GraphQL backend.

- Encourage the use **good practices**, **common patterns** and standard APIs.

- Be transport / application agnostic. The default use case is HTTP, but no assumption is made over this, and not even about the web server you want to use. Do you need to add your custom authorization / authentication? Do you need custom metrics? Blossom should stay out of the way.

These **are not** Blossom goals:

- Be a **plug and play** solution. Blossom wans to help you automating many of the common workflows, in order for you to focus on the business logic and deciding what you do expose on the graph and what you don't. Blossom expects you to think about how you're linking your graph to your data sources.

- Break any standard APIs. Blossom makes heavy use of [GraphQL.js](https://graphql.org/graphql-js/), the official implementation, in both the framework runtime and its CLI tool. Instead of wrapping this API, we try to augment it.

- Encourage the use of monolithic APIs. While Blossom lets you create an entire project from scratch, it's expected you distribute your data sources to different APIs as your application grows up and make Blossom be a proxy to them.

- Be strict about this goals. These can change over time!

# Documentation Overview

The documentation of this project aims to be structured on a deductive way: from understanding the big picture and how things are stitched together to specifics about the API reference:

- **Getting Started** guides you on installing Blossom on your computer and understanding the basic concepts about the architecture and the platform.

- **Tutorials** shows you multiple tutorials for building applications with Blossom, from the basics to more complicated applications.

- **μGuides** (*micro*-guides) aims to be a syllabus of multiple short guides that solve specifics and common tasks that you might need to do with Blossom.

- **Deep Dive** contains a selection of topics aimed to help the developer to understand more advanced concepts about the framework.

- **API Reference** contains all the information about common Blossom APIs. This section does not aim to be self-explanatory, but to be used as a handbook of the specifics of the frameowkr.

# Contribute

Blossom is an open source project and contributing is encouraged to everyone, which includes reporting your issues, proposing features, commenting on RFCs, giving your input and writing pull requests.

You can check out the [GitHub monorepo](https://github.com/spsoto/blossom) to start contributing!
