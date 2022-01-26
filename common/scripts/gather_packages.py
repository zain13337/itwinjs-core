import sys, os, glob, re, subprocess
import shutil

def determineDistTag(currentVer, latestVer, previousVer):
  ## The master branch is the only one that should get the 'nightly' release tag
  mainBranch = "master"

  distTag = None
  if len(sys.argv) == 4:
    branchName = sys.argv[3]

    print ("Branch name: " + branchName + "\nCurrent version: " + currentVer + "\nLatest version: " + latestVer + "\Previous version: " + previousVer)

    # The most common case is the tag will be a nightly tag
    if mainBranch in branchName:
      distTag = "nightly"
    elif "release/" in branchName:
      print ("On a release branch")

      # Parse current version
      currentDevVer = -1
      if ("-" in currentVer):
        currentVer, currentDevVer = currentVer.split("-")
        currentDevVer = int(currentDevVer.split(".")[1])
      currentMajorVer, currentMinorVer, currentPatchVer = currentVer.split(".")
      currentMajorVer, currentMinorVer, currentPatchVer = int(currentMajorVer), int(currentMinorVer), int(currentPatchVer)

      if latestVer == "":
        # First release of new package
        if (currentDevVer != -1):
          distTag = "rc"
        else:
          distTag = "latest"

      else:
        # Parse latest version
        latestDevVer = -1
        if ("-" in latestVer):
          latestVer, latestDevVer = latestVer.split("-")
          latestDevVer = int(latestDevVer.split(".")[1])
        latestMajorVer, latestMinorVer, latestPatchVer = latestVer.split(".")
        latestMajorVer, latestMinorVer, latestPatchVer = int(latestMajorVer), int(latestMinorVer), int(latestPatchVer)

        if previousVer == "":
          if currentMajorVer < latestMajorVer:
            # Latest major version is greater than current package version and no version is tagged 'previous' for this package,
            # assign tag to this release.
            distTag = "previous"
        else:
          # Parse previous version
          previousDevVer = -1
          if ("-" in previousVer):
            previousVer, previousDevVer = previousVer.split("-")
            latestDevVer = int(latestDevVer.split(".")[1])
          previousMajorVer, previousMinorVer, previousPatchVer = previousVer.split(".")
          previousMajorVer, previousMinorVer, previousPatchVer = int(previousMajorVer), int(previousMinorVer), int(previousPatchVer)

          # We should never see a dev version except in the case of a release candidate for the next latest release
          if (currentDevVer != -1):
            distTag = "rc"
          else:
            if currentMajorVer > latestMajorVer:
              distTag = "latest"
            elif currentMajorVer < latestMajorVer:
              if currentMajorVer > previousMajorVer:
                distTag = "previous"
              elif currentMajorVer == previousMajorVer:
                if currentMinorVer >= previousMinorVer:
                  # Give previous tag to newer minor or patch release of old major version
                  distTag = "previous"
            else:
              # If current minor version < latest, don't add dist tag
              if currentMinorVer > latestMinorVer:
                distTag = "latest"
              elif currentMinorVer == latestMinorVer:
                # Major/Minor versions are equal, give latest tag if new patch or first release
                if currentPatchVer > latestPatchVer:
                  # Give latest tag if new patch
                  distTag = "latest"
                elif currentPatchVer == latestPatchVer and latestDevVer != -1:
                  # Give latest tag if first non rc release of package
                  distTag = "latest"

  if distTag is None:
    return

  print ("Setting dist tag " + distTag)
  print ("##vso[build.addbuildtag]dist-tag " + distTag)
  print ("##vso[task.setvariable variable=isRelease;isSecret=false;isOutput=true;]true")

artifactStagingDir = os.path.realpath(sys.argv[1])
sourcesDirectory = os.path.realpath(sys.argv[2])

## Setup
stagingDir = os.path.join(artifactStagingDir, "imodeljs", "packages")
os.makedirs(stagingDir)

packageDir = os.path.join(sourcesDirectory, "common", "temp", "artifacts", "packages")

artifactPaths = glob.glob(os.path.join(packageDir, "*.tgz"))

packagesToPublish = False
localVer = ""
latestVer = ""
previousVer = ""
for artifact in artifactPaths:
  baseName = os.path.basename(artifact)
  print ("")
  print ("Checking package: '" + baseName + "'...")

  localVer = re.search(r'(\d\.\d.*).tgz', baseName)
  localVer = localVer.group(1)

  packageName = baseName[:(len(baseName) - len(localVer) - 5)]
  packageName = "@" + packageName.replace("-", "/", 1)

  command = "npm view " + packageName + "@" + localVer + " version"
  proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)

  # We are going to assume if a version is provided back from the above call, that this version exists
  # on the server.  Otherwise, it returns an empty string.
  serverVer = proc.communicate()[0]

  if proc.returncode != 0:
    packagesToPublish = True
    print ("The package does not yet exist.  Copying " + packageName + " to staging area.")
    shutil.copy(artifact, stagingDir)
    continue

  if 0 != len(serverVer):
    print ("The version already exists.  Skipping...")
    continue

  packagesToPublish = True
  print ("Local version is newer than on the server.  Copying package " + packageName + " to staging area.")
  shutil.copy(artifact, stagingDir)

  command = "npm view " + packageName + " dist-tags.latest"
  proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  latestVer = proc.communicate()[0]
  if len(latestVer) == 0:
    print("No version found for dist-tag 'latest'")

  command = "npm view " + packageName + " dist-tags.previous"
  proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  previousVer = proc.communicate()[0]
  if len(previousVer) == 0:
    print("No version found for dist-tag 'previous'")

if packagesToPublish:
  determineDistTag(localVer, latestVer, previousVer)
  print ("There are packages to publish.")
  print ("##vso[build.addbuildtag]package-release")
  print ("##vso[task.setvariable variable=isRelease;isSecret=false;isOutput=true;]true")
else:
  print ("All packages are up-to-date.")