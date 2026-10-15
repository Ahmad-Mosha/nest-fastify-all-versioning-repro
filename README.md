# `@All()` ignores the route version with `FastifyAdapter`

Minimal reproduction for [nestjs/nest#18155](https://github.com/nestjs/nest/issues/18155).

With `FastifyAdapter` and header, media type or custom versioning, routes declared with `@All()` are registered without their version:

- A versioned `@All()` route also answers requests for other versions, and requests without a version, instead of returning 404.
- Two `@All()` routes with different versions on the same path can't coexist. The app fails at startup with `FST_ERR_DUPLICATED_ROUTE`.

`@Get()` on Fastify and `@All()` on Express behave as documented, so both are included as controls.

## Run it

```bash
npm ci
npm start
```

`npm start` compiles `src/main.ts` with `tsc` and starts the same controllers on an Express app and on a Fastify app. It then sends the same requests to both and compares each response with the expected one. The script exits with code 1 while any check differs.

## Code

Everything is in [`src/main.ts`](src/main.ts):

- `CatsV1Controller` (version `1`) has a `@Get('get')` and an `@All('all')` route.
- `CatsV2Controller` (version `2`) has an `@All('all')` route on the same path.
- Header versioning is enabled with `X-API-Version`.
- Scenario "v1 only" registers `CatsV1Controller`; scenario "v1 + v2" registers both controllers.

## Output

```
Node v24.21.0, @nestjs/core 12.1.3, @nestjs/platform-fastify 12.1.3, fastify 5.12.5, express 5.2.1
Header versioning: X-API-Version

express v1 only GET /cats/get X-API-Version: 1       expected 200 v1   actual 200 v1
express v1 only GET /cats/get X-API-Version: 2       expected 404      actual 404
express v1 only GET /cats/get X-API-Version: (none)  expected 404      actual 404
express v1 only GET /cats/all X-API-Version: 1       expected 200 v1   actual 200 v1
express v1 only GET /cats/all X-API-Version: 2       expected 404      actual 404
express v1 only GET /cats/all X-API-Version: (none)  expected 404      actual 404
express v1 + v2 GET /cats/all X-API-Version: 1       expected 200 v1   actual 200 v1
express v1 + v2 GET /cats/all X-API-Version: 2       expected 200 v2   actual 200 v2
express v1 + v2 GET /cats/all X-API-Version: (none)  expected 404      actual 404
fastify v1 only GET /cats/get X-API-Version: 1       expected 200 v1   actual 200 v1
fastify v1 only GET /cats/get X-API-Version: 2       expected 404      actual 404
fastify v1 only GET /cats/get X-API-Version: (none)  expected 404      actual 404
fastify v1 only GET /cats/all X-API-Version: 1       expected 200 v1   actual 200 v1
fastify v1 only GET /cats/all X-API-Version: 2       expected 404      actual 200 v1   <-- differs
fastify v1 only GET /cats/all X-API-Version: (none)  expected 404      actual 200 v1   <-- differs
fastify v1 + v2 app startup                          expected starts   actual fails: FST_ERR_DUPLICATED_ROUTE   <-- differs
                Method '[ 'GET', 'HEAD', 'TRACE', 'DELETE', 'OPTIONS', 'PATCH', 'PUT', 'POST', 'QUERY' ]' already declared for route '/cats/all'

3 check(s) differ from the expected behavior.
```

The same output appears on Node 20.20.2, 22.23.2 and 24.21.0 (macOS).

## Versions

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/platform-fastify`: 12.1.3
- Resolved through the lockfile: `fastify` 5.12.5, `find-my-way` 9.9.0, `express` 5.2.1
- TypeScript 6.0.3

The same behavior shows up with 11.2.7.
