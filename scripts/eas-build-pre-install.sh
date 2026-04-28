#!/bin/bash
# Fix CocoaPods objectVersion 70 issue on Xcode 16
if [ -f "ios/KolasysAI.xcodeproj/project.pbxproj" ]; then
  sed -i '' 's/objectVersion = 70/objectVersion = 60/' ios/KolasysAI.xcodeproj/project.pbxproj 2>/dev/null || \
  sed -i 's/objectVersion = 70/objectVersion = 60/' ios/KolasysAI.xcodeproj/project.pbxproj
  echo "Fixed objectVersion in project.pbxproj"
fi
