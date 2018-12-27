# Contributing Guidelines

**Work in progress**

## Testing

- Unit testing is made on a **module** basis, which means:

  - If a module has two functions `a()` and `b()` and `b()` calls `a()`, no
    mocking for `a()` shall be produced when `b()` is tested. This is because
    as of now is currently no possible to do such thing.

    More information: https://github.com/facebook/jest/issues/936. Solutions
    discussed in this issue are unsufficient to provide maintainable code.

  - If a module is calling another module, then mocking **must** be performed.
    There's no limitation for this case.
    