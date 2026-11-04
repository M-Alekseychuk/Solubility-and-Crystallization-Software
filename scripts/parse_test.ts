const text = `Sequence Table: Bracketing Mode: None
Sample Name Location Cal
Lvl
Injection Date Sample Dilution Factors
Cal1 P1-A2 1 2026-02-02 16:41:04+01:00 1;1;1;1;1
Cal2 P1-A3 2 2026-02-02 16:49:50+01:00 1;1;1;1;1
Cal3 P1-A4 3 2026-02-02 16:58:35+01:00 1;1;1;1;1
MYA-10435-01 - 28
°C
P1-B4 2026-02-09 17:16:26+01:00 50;1;1;1;1
MYA-10435-02 - 28 °C P1-B5 2026-02-09 17:25:12+01:00 50;1;1;1;1`;

const flatText = text.replace(/\n/g, ' ');

const sampleName = "MYA-10435-01 - 28 °C";
const escapedName = sampleName.replace(/\s+/g, '\\s*');
const regex = new RegExp(escapedName + '\\s+[A-Z]\\d+-[A-Z0-9]+\\s+\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}[+-]\\d{2}:\\d{2}\\s+(\\d+);', 'i');
console.log(regex.exec(flatText));

