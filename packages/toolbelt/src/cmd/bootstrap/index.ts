import koaBootstrap from './koa/koa.bootstrap';
import { cliRunWrapper } from '../../lib/runtime';

export type BootstrapOptions = {
  template: string;
};

export async function bootstrapProject(opts: BootstrapOptions) {
  const { template } = opts;

  switch (template) {
    case 'koa':
      await koaBootstrap();
      break;
    default:
      throw new Error('Invalid template. Available options: koa');
      break;
  }
}

export default cliRunWrapper(bootstrapProject);
