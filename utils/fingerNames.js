const fingerNames = [
  'Left Thumb',
  'Left Index',
  'Left Middle',
  'Left Ring',
  'Left Little',
  'Right Thumb',
  'Right Index',
  'Right Middle',
  'Right Ring',
  'Right Little'
];

function getFingerName(fingerIndex) {
  const index = Number(fingerIndex);
  return fingerNames[index] || `Finger ${fingerIndex}`;
}

module.exports = {
  fingerNames,
  getFingerName
};
