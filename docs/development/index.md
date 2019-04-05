# Development Environment

## Setup

- Clone the repository.
  
- Define a `$BLOSSOM_DEV_PATH` environment variable that indicates where your
  Blossom repository is cloned in the development environment:

  ```shell
  # You can also add this to your ~/.bash_profile or ~/.zshrc:
  export BLOSSOM_DEV_PATH=/path/to/your/local/blossom/repo
  ```

- Instead of installing Blossom as a NPM package on a project, install it as a
  path. This way, any change you introduce to `$BLOSSOM_DEV_PATH`:

  ```shell
  npm install --dev $BLOSSOM_DEV_PATH/packages/toolbelt
  ```
