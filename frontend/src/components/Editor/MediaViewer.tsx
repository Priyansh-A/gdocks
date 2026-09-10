'use client';

import { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Maximize } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MediaViewerProps {
  url: string;
  title: string;
  mimeType: string;
  readOnly?: boolean;
}

export function MediaViewer({ url, title, mimeType, readOnly = true }: MediaViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const isImage = mimeType?.startsWith('image/');
  const isVideo = mimeType?.startsWith('video/');
  const isAudio = mimeType?.startsWith('audio/');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download started');
  };

  if (isImage) {
    return (
      <div className="flex flex-col h-full bg-gray-50 rounded-lg">
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <img
            src={url}
            alt={title}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-white border-t border-gray-200 rounded-b-lg">
          <span className="text-sm text-gray-600">{title}</span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex flex-col h-full bg-gray-900 rounded-lg">
        <video
          src={url}
          className="w-full max-h-[70vh] object-contain"
          controls
          autoPlay={false}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            setProgress((video.currentTime / video.duration) * 100);
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
          }}
        />
        <div className="flex items-center justify-between p-3 bg-gray-800 text-white rounded-b-lg">
          <span className="text-sm">{title}</span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex flex-col h-full bg-gray-50 rounded-lg p-6">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Play className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">Audio file</p>
          <audio
            src={url}
            controls
            className="w-full mt-6"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>
        <div className="flex justify-end p-3 border-t border-gray-200 mt-4">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
      <p className="text-gray-600">Unsupported media type: {mimeType}</p>
      <button
        onClick={handleDownload}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Download File
      </button>
    </div>
  );
}