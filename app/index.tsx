import {
  Switch,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { BatteryState, getBatteryLevelAsync, usePowerState } from "expo-battery";
import { useAudioPlayer } from "expo-audio";
import { useKeepAwake } from "expo-keep-awake";
import * as Brightness from "expo-brightness";

// Sound options as per request
const SOUND_OPTIONS = [
  { id: "s1", label: "Default", file: require("../assets/audio/ringtone.mp3") },
  {
    id: "s2",
    label: "IPhone Alarm",
    file: require("../assets/audio/iphone_alarm.mp3"),
  },
  {
    id: "s3",
    label: "IPhone Ringtone",
    file: require("../assets/audio/iphone_ringtone.mp3"),
  },
  {
    id: "s4",
    label: "Alarm Clock",
    file: require("../assets/audio/alarm_clock.mp3"),
  },
];

// Blank time dropdown options (in ms)
const BLANK_TIME_OPTIONS = [
  { id: "t1", label: "5 sec", value: 5000 },
  { id: "t2", label: "15 sec", value: 15000 },
  { id: "t3", label: "30 sec", value: 30000 },
  { id: "t4", label: "1 min", value: 60000 },
  { id: "t5", label: "5 min", value: 5 * 60000 },
  { id: "t6", label: "10 min", value: 10 * 60000 },
];

function getBatteryStateLabel(state: BatteryState | null | undefined) {
  if (state === BatteryState.CHARGING) return "Charging";
  if (state === BatteryState.UNPLUGGED) return "Discharging";
  if (state === BatteryState.FULL) return "Full";
  return "Unknown";
}

export default function Index() {
  useKeepAwake(); // Keep the screen awake

  const [isLimitEnabled, setIsLimitEnabled] = useState(false);
  const [inputValue, setInputValueRaw] = useState("80");
  // We'll now store batteryLevel in state and update it with a polling effect
  const { batteryState } = usePowerState();
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSoundDropdown, setShowSoundDropdown] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState<string>(
    SOUND_OPTIONS[0].id
  );
  const [blanked, setBlanked] = useState(false);

  // Inactivity/dim timer customizations
  const [showBlankDropdown, setShowBlankDropdown] = useState(false);
  const [selectedBlankTimeId, setSelectedBlankTimeId] = useState(
    BLANK_TIME_OPTIONS[0].id
  );

  // Find the selected timeout value in ms
  const selectedBlankTimeObj =
    BLANK_TIME_OPTIONS.find((opt) => opt.id === selectedBlankTimeId) ||
    BLANK_TIME_OPTIONS[0];
  const selectedBlankTime = selectedBlankTimeObj.value;

  // For inactivity/dim timer
  const dimTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // For storing system default brightness
  const defaultBrightness = useRef<number | null>(null);

  // Dimming function: blanks UI and sets brightness to 0
  const dimScreen = async () => {
    setBlanked(true);
    try {
      await Brightness.setSystemBrightnessAsync(0);
    } catch {}
  };

  // When user taps: restore system brightness mode and show UI
  const handleUserTouch = async () => {
    try {
      const mode = await Brightness.getSystemBrightnessModeAsync?.();
      if (
        mode !== undefined &&
        Brightness.setSystemBrightnessModeAsync &&
        Brightness.BrightnessMode
      ) {
        await Brightness.setSystemBrightnessModeAsync(
          Brightness.BrightnessMode.AUTOMATIC
        );
      } else if (defaultBrightness.current != null) {
        await Brightness.setSystemBrightnessAsync(defaultBrightness.current);
      }
    } catch {}
    setBlanked(false);
    resetTimer();
  };

  // Reset inactivity timer with selected time
  const resetTimer = () => {
    if (dimTimeout.current) clearTimeout(dimTimeout.current);
    dimTimeout.current = setTimeout(dimScreen, selectedBlankTime);
  };

  // On mount: ask for brightness permissions, store default brightness, and start timer
  useEffect(() => {
    (async () => {
      try {
        await Brightness.requestPermissionsAsync();
        defaultBrightness.current = await Brightness.getSystemBrightnessAsync();
        if (Brightness.getSystemBrightnessModeAsync) {
          await Brightness.getSystemBrightnessModeAsync();
        }
      } catch {}
      resetTimer();
    })();
    return () => {
      if (dimTimeout.current) clearTimeout(dimTimeout.current);
      // Optionally restore brightness on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also reset timer when blank time changes
  useEffect(() => {
    resetTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlankTimeId]);

  // Battery polling logic to keep batteryLevel up-to-date
  useEffect(() => {
    let isMounted = true;

    async function fetchBatteryLevel() {
      try {
        const lvl = await getBatteryLevelAsync();
        if (isMounted) setBatteryLevel(lvl);
      } catch {}
    }

    fetchBatteryLevel(); // initial read

    const interval = setInterval(fetchBatteryLevel, 2000); // Poll every 2s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Enforce that inputValue never goes over 100 and is 0 or more
  const setInputValue = (text: string) => {
    let num = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    setInputValueRaw(String(num));
  };

  // Use the selected sound for the audio player
  const selectedSound =
    SOUND_OPTIONS.find((opt) => opt.id === selectedSoundId) || SOUND_OPTIONS[0];
  const player = useAudioPlayer(selectedSound.file);

  // Update player.loop based on isPlaying
  useEffect(() => {
    player.loop = isPlaying;
  }, [isPlaying, player]);

  let batteryPct = getBatteryPercentage(batteryLevel);
  // batteryLevel from expo-battery is decimal [0-1], so scale to percent (0-100)
  function getBatteryPercentage(
    batteryLevel: number | null | undefined
  ): number {
    if (
      batteryLevel === null ||
      batteryLevel === undefined ||
      isNaN(Number(batteryLevel))
    ) {
      return 0;
    }
    batteryPct = Math.round(Number(batteryLevel) * 100);
    return Math.round(Number(batteryLevel) * 100);
  }

  // Play audio if inputValue equals batteryPct and stop/pause if stop is clicked
  useEffect(() => {
    if (isLimitEnabled && parseInt(inputValue) === batteryPct) {
      setIsPlaying(true);
    }
  }, [batteryPct, inputValue, isLimitEnabled]);

  useEffect(() => {
    if (isPlaying) {
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player]);

  function getBatteryColor() {
    if (batteryPct <= 20) return "bg-red-600";
    if (batteryPct < 60) return "bg-yellow-400";
    return "bg-green-500";
  }

  if (
    batteryLevel === null ||
    batteryLevel === undefined ||
    isNaN(Number(batteryLevel))
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-xl text-white">Loading battery info...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleUserTouch}>
      <View className="h-full w-full">
        {blanked ? (
          <View style={{ flex: 1, backgroundColor: "#000" }} />
        ) : (
          <View className="flex-1 items-center justify-center bg-black">
            {/* Title */}
            <Text className="text-4xl font-semibold text-white">
              Battery Alert
            </Text>

            {/* Battery Icon */}
            <View className="flex-row items-center my-8">
              <View className="w-40 h-20 border-2 border-white rounded-xl mr-1 overflow-hidden bg-transparent relative">
                <View
                  className={`absolute left-0 top-0 h-full rounded-lg ${getBatteryColor()}`}
                  style={{ width: `${batteryPct}%` }}
                />
              </View>
              <View className="w-3 h-7 rounded bg-white" />
            </View>

            {/* Battery Percentage */}
            <Text className="text-xl font-bold text-white">{batteryPct}%</Text>
            <Text className="text-xl font-bold text-white">
              Status: {getBatteryStateLabel(batteryState)}
            </Text>

            {/* Enable Limit Switch */}
            <View className="w-80 border-2 flex-row items-center justify-between mt-4">
              <Text className="text-white text-xl font-semibold">
                Enable Limit:{" "}
              </Text>
              <Switch
                value={isLimitEnabled}
                onValueChange={setIsLimitEnabled}
                trackColor={{ false: "#dc2626", true: "#22c55e" }}
                ios_backgroundColor="#dc2626"
                thumbColor="#fff"
              />
            </View>

            {/* Inactivity/Dim Timer Dropdown */}
            <View className="w-80 mt-8">
              <Text className="text-white mb-2">Screen Blank After:</Text>
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  className="border border-neutral-200 rounded-xl bg-white p-3"
                  onPress={() => setShowBlankDropdown((prev) => !prev)}
                >
                  <Text className="text-black">
                    {selectedBlankTimeObj.label}
                  </Text>
                </TouchableOpacity>
                {showBlankDropdown && (
                  <View
                    className="border border-neutral-200 rounded-xl bg-white mt-2 w-full"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    {BLANK_TIME_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        className="p-3"
                        onPress={() => {
                          setSelectedBlankTimeId(option.id);
                          setShowBlankDropdown(false);
                          resetTimer();
                        }}
                      >
                        <Text className="text-black">{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Input */}
            <View className="w-80 mt-8">
              <Text className="text-white">Enter the battery percentage:</Text>
              <View className="items-center justify-center mt-2">
                <TextInput
                  className="h-14 w-80 border border-neutral-200 rounded-xl text-center text-2xl text-white font-bold"
                  value={inputValue}
                  onChangeText={setInputValue}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            </View>

            {/* Sound Dropdown */}
            <View className="w-80 mt-8">
              <Text className="text-white mb-2">Select Alert Sound:</Text>
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  className="border border-neutral-200 rounded-xl bg-white p-3"
                  onPress={() => setShowSoundDropdown((prev) => !prev)}
                >
                  <Text className="text-black">
                    {
                      SOUND_OPTIONS.find((opt) => opt.id === selectedSoundId)
                        ?.label
                    }
                  </Text>
                </TouchableOpacity>
                {showSoundDropdown && (
                  <View
                    className="border border-neutral-200 rounded-xl bg-white mt-2 w-full"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    {SOUND_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        className="p-3"
                        onPress={() => {
                          setSelectedSoundId(option.id);
                          setShowSoundDropdown(false);
                        }}
                      >
                        <Text className="text-black">{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Play/Stop Button */}
            <View className="w-80 mt-8">
              <TouchableOpacity
                className={`h-12 w-full items-center justify-center rounded-xl ${
                  isPlaying ? "bg-red-600" : "bg-blue-400"
                }`}
                onPress={() => setIsPlaying((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Text className="text-white font-semibold text-base">
                  {isPlaying ? "Stop" : "Play"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}
