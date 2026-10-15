import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import {
  All,
  Controller,
  Get,
  Module,
  VersioningType,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';

@Controller({ path: 'cats', version: '1' })
class CatsV1Controller {
  @Get('get')
  get() {
    return 'v1';
  }

  @All('all')
  all() {
    return 'v1';
  }
}

@Controller({ path: 'cats', version: '2' })
class CatsV2Controller {
  @All('all')
  all() {
    return 'v2';
  }
}

// [path, X-API-Version header (undefined = not sent), expected response]
type Check = [string, string | undefined, string];

const scenarios: { name: string; controllers: Type[]; checks: Check[] }[] = [
  {
    name: 'v1 only',
    controllers: [CatsV1Controller],
    checks: [
      ['/cats/get', '1', '200 v1'],
      ['/cats/get', '2', '404'],
      ['/cats/get', undefined, '404'],
      ['/cats/all', '1', '200 v1'],
      ['/cats/all', '2', '404'],
      ['/cats/all', undefined, '404'],
    ],
  },
  {
    name: 'v1 + v2',
    controllers: [CatsV1Controller, CatsV2Controller],
    checks: [
      ['/cats/all', '1', '200 v1'],
      ['/cats/all', '2', '200 v2'],
      ['/cats/all', undefined, '404'],
    ],
  },
];

const adapters = {
  express: () => new ExpressAdapter(),
  fastify: () => new FastifyAdapter(),
};

let problems = 0;

function report(label: string, expected: string, actual: string) {
  const differs = actual !== expected;
  if (differs) problems++;
  console.log(
    `${label.padEnd(52)} expected ${expected.padEnd(8)} actual ${actual}${differs ? '   <-- differs' : ''}`,
  );
}

function version(pkg: string) {
  const url = new URL(`../node_modules/${pkg}/package.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')).version;
}

console.log(
  `Node ${process.version}, @nestjs/core ${version('@nestjs/core')}, ` +
    `@nestjs/platform-fastify ${version('@nestjs/platform-fastify')}, ` +
    `fastify ${version('fastify')}, express ${version('express')}`,
);
console.log('Header versioning: X-API-Version\n');

for (const [adapterName, createAdapter] of Object.entries(adapters)) {
  for (const { name, controllers, checks } of scenarios) {
    const prefix = `${adapterName.padEnd(7)} ${name.padEnd(7)}`;

    @Module({ controllers })
    class AppModule {}

    let app;
    try {
      app = await NestFactory.create(AppModule, createAdapter(), {
        logger: false,
      });
      app.enableVersioning({
        type: VersioningType.HEADER,
        header: 'X-API-Version',
      });
      await app.listen(0, '127.0.0.1');
    } catch (error: any) {
      report(`${prefix} app startup`, 'starts', `fails: ${error.code}`);
      console.log(`${' '.repeat(16)}${error.message.replace(/\s+/g, ' ')}`);
      continue;
    }

    const url = await app.getUrl();
    for (const [path, apiVersion, expected] of checks) {
      const res = await fetch(url + path, {
        headers: apiVersion ? { 'X-API-Version': apiVersion } : {},
      });
      const actual =
        res.status === 200 ? `200 ${await res.text()}` : `${res.status}`;
      report(
        `${prefix} GET ${path} X-API-Version: ${apiVersion ?? '(none)'}`,
        expected,
        actual,
      );
    }
    await app.close();
  }
}

console.log(
  problems === 0
    ? '\nAll checks match the expected behavior.'
    : `\n${problems} check(s) differ from the expected behavior.`,
);
process.exitCode = problems === 0 ? 0 : 1;
