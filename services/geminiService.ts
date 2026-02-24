import { GoogleGenAI } from "@google/genai";
import { MotionData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const identifyMotion = async (motionData: MotionData): Promise<string> => {
    // Subsample to reduce tokens (take 1 frame every ~0.5 seconds)
    // Assuming 30fps, that's every 15 frames
    const stride = 15;
    const sampleFrames = motionData.frames
        .filter((_, i) => i % stride === 0)
        .map(f => ({
            t: f.time.toFixed(2),
            // Simplify joints to key ones for classification
            j: {
                head: f.joints.head,
                hands: [f.joints.l_hand, f.joints.r_hand],
                feet: [f.joints.l_foot, f.joints.r_foot],
                hips: [f.joints.l_hip, f.joints.r_hip]
            }
        }));
    
    const prompt = `
    Analyze the following 3D motion capture data (Y-up coordinate system).
    The data represents a sequence of frames with joint positions.
    
    Identify the action being performed.
    Return ONLY a short label (e.g., "Jumping Jacks", "Walking", "Boxing", "Yoga Tree Pose").
    Do not add any explanation.
    
    Data:
    ${JSON.stringify(sampleFrames)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
        });
        return response.text?.trim() || "Unknown Action";
    } catch (e) {
        console.error("Gemini identification failed", e);
        return "Analysis Failed";
    }
}
