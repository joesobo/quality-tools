#!/usr/bin/env tsx

import { runListMutationPackagesCli } from '../mutation/analysis/listPackagesCommand';

runListMutationPackagesCli(process.argv.slice(2));
