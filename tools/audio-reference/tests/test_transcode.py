from audio_reference.transcode import ffmpeg_args


def test_ffmpeg_args_downmix_to_16k_mono():
    args = ffmpeg_args("in.flac", "out.16k.wav")
    assert args[0] == "ffmpeg"
    assert "-y" in args                  # overwrite without prompt
    assert "in.flac" in args
    assert "out.16k.wav" == args[-1]
    # 16kHz mono
    assert "16000" in args
    i = args.index("-ac")
    assert args[i + 1] == "1"
