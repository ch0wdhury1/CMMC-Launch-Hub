
import React, { useState, useEffect } from 'react';
import { trainingTracks, TrainingAudience, TrainingTrack } from '../../data/trainingSlides';
import { ChevronLeft, ChevronRight, Play, Loader2, Video, Info } from 'lucide-react';
import { Accordion } from '../Accordion';
import { generateTrainingVideo } from '../../services/videoService';

export const TrainingModule: React.FC = () => {
  const [activeTrack, setActiveTrack] = useState<TrainingTrack>(trainingTracks[0]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [openTopicIndex, setOpenTopicIndex] = useState<number | null>(0);
  
  // Video State
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleTrackChange = (trackId: TrainingAudience) => {
    const newTrack = trainingTracks.find(t => t.id === trackId);
    if (newTrack) {
      setActiveTrack(newTrack);
      setCurrentSlideIndex(0);
      setVideoUrl(null);
    }
  };

  const goNext = () => {
    setCurrentSlideIndex(prev => Math.min(prev + 1, activeTrack.slides.length - 1));
    setVideoUrl(null);
  };

  const goPrev = () => {
    setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
    setVideoUrl(null);
  };

  const handleToggleTopic = (index: number) => {
    setOpenTopicIndex(prev => (prev === index ? null : index));
  };
  
  const handleGenerateVideo = async () => {
    const slide = activeTrack.slides[currentSlideIndex];
    setIsGeneratingVideo(true);
    try {
      const url = await generateTrainingVideo(`Topic: ${slide.title}. Content: ${slide.description}. Explain ${slide.topics.map(t => t.label).join(", ")}.`);
      setVideoUrl(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate AI video. Please ensure you have a valid paid API key and try again.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const currentSlide = activeTrack.slides[currentSlideIndex];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border animate-fadeIn">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Training Modules</h2>
          <p className="mt-1 text-gray-600">Select a training track below to begin the interactive experience.</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center text-blue-800 text-sm">
           <Info className="h-5 w-5 mr-2" />
           <span>Complete modules to generate an automated training record.</span>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-2 border-b mb-6 pb-2">
        {trainingTracks.map(track => (
          <button
            key={track.id}
            onClick={() => handleTrackChange(track.id)}
            className={`pb-2 px-3 text-sm font-medium rounded-t-md transition-all ${
              activeTrack.id === track.id
                ? 'border-b-2 border-blue-600 text-blue-700 font-bold'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {track.label}
          </button>
        ))}
      </div>

      {/* Slide Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[450px]">
        {/* Left Column: Visual/Video Area */}
        <div className="space-y-4">
          <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative border-4 border-gray-800">
             {videoUrl ? (
               <video src={videoUrl} controls className="w-full h-full object-cover" />
             ) : (
               <div className="text-center p-8">
                 <Video className={`h-16 w-16 mx-auto mb-4 ${isGeneratingVideo ? 'text-blue-500 animate-pulse' : 'text-gray-600'}`} />
                 <h4 className="text-white font-bold text-lg mb-2">
                   {isGeneratingVideo ? 'Generating Training Video...' : 'No Video Loaded'}
                 </h4>
                 <p className="text-gray-400 text-sm mb-6">
                   {isGeneratingVideo ? 'Gemini Veo is crafting a professional cinematic explanation of this topic.' : 'You can generate an AI training video for this specific slide.'}
                 </p>
                 {!isGeneratingVideo && (
                   <button 
                    onClick={handleGenerateVideo}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition flex items-center mx-auto"
                   >
                     <Play className="h-4 w-4 mr-2 fill-current" />
                     Generate Slide Video
                   </button>
                 )}
                 {isGeneratingVideo && (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                      <p className="text-xs text-blue-400">This usually takes 60-90 seconds...</p>
                    </div>
                 )}
               </div>
             )}
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
             <h5 className="font-bold text-gray-700 text-sm mb-2 uppercase tracking-wider">Assessor Tip</h5>
             <p className="text-xs text-gray-600 leading-relaxed italic">
               &ldquo;When presenting this to employees, ensure you record attendance. Under CMMC Level 2, training without an attendance record is equivalent to no training at all.&rdquo;
             </p>
          </div>
        </div>

        {/* Right Column: Textual Content */}
        <div className="flex flex-col">
            <div className="flex-1">
                <h4 className="text-xl font-bold text-blue-900 mb-2">{currentSlide.title}</h4>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">{currentSlide.description}</p>
                <div className="space-y-2">
                  {currentSlide.topics.map((topic, index) => (
                    <Accordion
                      key={index}
                      label={topic.label}
                      content={topic.details}
                      isOpen={openTopicIndex === index}
                      onToggle={() => handleToggleTopic(index)}
                    />
                  ))}
                </div>
            </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
           <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Progress
          </div>
          <div className="w-48 bg-gray-100 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${((currentSlideIndex + 1) / activeTrack.slides.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-600">
            {currentSlideIndex + 1} / {activeTrack.slides.length}
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={goPrev}
            disabled={currentSlideIndex === 0}
            className="flex items-center px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed bg-white hover:bg-gray-50 transition shadow-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </button>
          <button
            onClick={goNext}
            disabled={currentSlideIndex === activeTrack.slides.length - 1}
            className="flex items-center px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition shadow-md"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
