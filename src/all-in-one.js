const serviceDefinitions = [
  { name: 'gateway', entrypoint: 'src/index.js' },
  { name: 'ingest', entrypoint: 'src/ingest/index.js' }
];

const services = serviceDefinitions.map(({ name, entrypoint }) => ({
  name,
  process: Bun.spawn(['bun', 'run', entrypoint], {
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
}));

let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Supervisor] Stopping services (${signal})...`);

  for (const service of services) {
    service.process.kill(signal);
  }

  await Promise.allSettled(services.map((service) => service.process.exited));
  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

console.log(`[Supervisor] Started ${services.map(({ name }) => name).join(' + ')} services.`);

const exits = services.map(async (service) => ({
  name: service.name,
  exitCode: await service.process.exited
}));

const firstExit = await Promise.race(exits);

if (!shuttingDown) {
  console.error(`[Supervisor] ${firstExit.name} exited with code ${firstExit.exitCode}.`);
  await shutdown('SIGTERM', firstExit.exitCode || 1);
}
