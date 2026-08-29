# Portable Windows helper: create the EMMY database, tables and demo user.
#
# It runs setup_database.py with the backend virtual environment, which applies
# the schema from db.sql and the demo account from seed.sql using the DB_*
# values in backend/.env. There is no schema copy in this file, so nothing can
# drift from db.sql. Safe to re-run.
#
# Prerequisites: MySQL running locally, and backend/.env filled in (copy it
# from .env.example). Run from anywhere:
#
#   powershell -ExecutionPolicy Bypass -File setup_mysql.ps1
#
# (An older version of this script reset the MySQL root password and carried
# its own copy of the schema. That copy went stale and its paths broke when the
# project folder was flattened, so it was replaced with this wrapper. The old
# version is in git history if the root-password reset is ever needed again.)

$ErrorActionPreference = "Stop"

$here = $PSScriptRoot
$python = Join-Path $here "VirtualEnvironment\Scripts\python.exe"
$setup = Join-Path $here "setup_database.py"

if (-not (Test-Path $python)) {
    Write-Host "Backend virtual environment not found at:"
    Write-Host "  $python"
    Write-Host ""
    Write-Host "Create it first, from the backend folder:"
    Write-Host "  python -m venv VirtualEnvironment"
    Write-Host "  .\VirtualEnvironment\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

if (-not (Test-Path (Join-Path $here ".env"))) {
    Write-Host "backend\.env not found. Copy it from the template and set your DB values:"
    Write-Host "  copy .env.example .env"
    exit 1
}

Write-Host "Setting up the EMMY database from db.sql + seed.sql..."
& $python $setup
