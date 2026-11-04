import fs from 'fs';

let content = fs.readFileSync('src/data/solvents.ts', 'utf-8');

const fixEhs = (name: string, newEhs: number) => {
  // Regex to find the solvent block and update its ehsScore
  const regex = new RegExp(`("name":\\s*"${name}"[\\s\\S]*?"ehsScore":\\s*)[\\d\\.]+`, 'g');
  content = content.replace(regex, `$1${newEhs}`);
};

// Known safe/green solvents (GSK/Sanofi/CHEM21 recommended)
fixEhs('Water', 10.0);
fixEhs('Ethanol', 8.5);
fixEhs('iso-Propanol', 8.5);
fixEhs('1-Propanol', 8.0);
fixEhs('Acetone', 8.0);
fixEhs('Ethyl Acetate', 8.0);
fixEhs('Isopropyl acetate', 8.0);
fixEhs('Butyl acetate', 7.5); // good, but VOC/smell
fixEhs('1-Butanol', 7.5);
fixEhs('2-Butanol', 7.5);
fixEhs('Anisole', 8.0);
fixEhs('Dimethyl Sulfoxide', 8.5); // DMSO is green but skin penetration
fixEhs('Glycerol', 9.0);
fixEhs('Propylene glycol', 8.5);
fixEhs('Ethylene glycol', 5.0); // Toxic! Should NOT be 8.1
fixEhs('Methanol', 5.0); // Toxic
fixEhs('Acetonitrile', 5.0); // Toxic/Cyanide
fixEhs('Tetrahydrofuran', 4.0); // Peroxides, not green
fixEhs('1,4-dioxane', 2.0); // Carcinogen!
fixEhs('Benzene', 1.0); // Carcinogen!
fixEhs('Hexane', 2.0); // Neurotoxic
fixEhs('Dichloromethane', 2.0); // Carcinogen
fixEhs('Chloroform', 1.5); // Carcinogen
fixEhs('Carbon tetrachloride', 1.0); // Carcinogen
fixEhs('N,N-dimethylformamide', 3.0); // Reprotoxic
fixEhs('Dimethylformamide', 3.0);
fixEhs('N,N-dimethylacetamide', 3.0); // Reprotoxic
fixEhs('N-Methyl-2-pyrrolidone (NMP)', 3.0); // Reprotoxic
fixEhs('2-Ethoxyethanol', 2.0); // Reprotoxic
fixEhs('2-Methoxyethanol', 2.0); // Reprotoxic
fixEhs('Toluene', 4.0); // Reprotoxic/Flammable

fs.writeFileSync('src/data/solvents.ts', content);
console.log('Fixed EHS scores!');
