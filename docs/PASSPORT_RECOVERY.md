# WD Passport forensic recovery (do not format)

macOS dialog **“The disk you attached was not readable by this computer.”** means the USB bridge is talking and the platters are probably fine. The Mac cannot read the **partition table / filesystem directory**. That is **not** proof the clone is gone.

## Do this in the next 10 seconds

| Button | Do it? |
| --- | --- |
| **Ignore** | **Yes.** Keeps the disk attached so Disk Utility / Terminal can work. |
| **Eject** | Only if the drive is clicking, grinding, or repeating disconnects. Then stop and use a lab. |
| **Initialize…** | **Never.** That is a format. It overwrites the partition map and makes recovery much harder. |

Do **not** Erase, do **not** Partition, do **not** run First Aid on a volume that Disk Utility offers to *create*.

## What the earlier Info window meant

You selected the **physical device** (`disk4` — WD My Passport 260D Media), not a mounted volume:

- Writable No / 0 bytes free / used = full size is **normal for the raw disk row**
- Finder only shows **mounted volumes**, so the repo cannot appear until a partition mounts

## Run on the Mac (this cloud agent cannot see USB)

1. Click **Ignore**.
2. Leave the Passport plugged into a **direct Mac USB port** (not a power-only hub). Prefer the cable that came with the drive.
3. Open **Terminal** and run the **read-only** script from this repo:

```bash
cd /path/to/TaxCertificateProcessor
bash scripts/passport-forensic-mac.sh
```

It only prints `diskutil list`, GPT/MBR signatures, and partition guesses. It does **not** erase, initialize, or write a new partition map.

4. If a volume name appears, mount it and copy the clone **off** the Passport onto another disk **before** any repair-write:

```bash
ls /Volumes
# then copy, do not work in-place as the only copy
```

5. If the script finds a GPT or NTFS/exFAT signature but macOS still will not mount:

```bash
# partition-map repair only — still not a format
diskutil verifyDisk disk4
# only if verify is clean enough and you accepted the risk:
# diskutil repairDisk disk4
```

6. If there is still no volume: **TestDisk** in *Analyse → Quick Search → P (list files)*. Copy files to another drive. Use **Write** only after you have seen the workplace-technologies folder in that file list.

   Homebrew (on the Mac): `brew install testdisk`

## Stop and use a lab if

- The drive **clicks**, **beeps**, or **cycles** power
- Capacity shows as **0** or a few MB after unplug/replug
- TestDisk file list is **encrypted garbage** (some WD Passports use a USB encryption bridge)
- You only have one copy of that clone

US labs that handle WD Passport USB-bridge / GPT damage include specialist HDD shops (e.g. Rossmann-class WD Passport recovery). That is the path if DIY listing fails — still **do not Initialize**.

## After a volume mounts

```bash
export WORKPLACE_CLONE_PATH="/Volumes/<name>/path/to/workplace-technologies"
npm run import:workplace
```

Or start `cursor worker start` on that Mac so a cloud agent can see `/Volumes`.
