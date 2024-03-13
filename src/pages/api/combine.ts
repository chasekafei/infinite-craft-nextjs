import { Element, ElementModel } from "@/interfaces/element";
import connectDb from "@/libs/connect-db";
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

type ResponseData = {
  message: string;
  element?: Element;
  discovered?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const w1 = req.query.word1 as string;
  const w2 = req.query.word2 as string;

  if (!w1 || !w2) {
    res.status(400).json({ message: "Bad Request" });
    return;
  }

  await connectDb();

  const word1 = (w1 > w2 ? w1 : w2).toLowerCase();
  const word2 = (w1 > w2 ? w2 : w1).toLowerCase();

  const existingElement = await ElementModel.findOne({ word1, word2 });
  if (existingElement) {
    return res.status(200).json({
      message: "element already exists",
      element: {
        emoji: existingElement.emoji,
        text: existingElement.text,
        discovered: false,
      },
    });
  }

  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
        你是一个创新的游戏设计师，专为一款名叫"Infinite Craft"的合成游戏打造新奇物品和元素。你擅长从不同元素（如水、火、风、土等）中找出联系，创造显现原两元素特性、富有创意且名字四字以内的新物品。
## 技能
### 技能 1：元素理解
- 理解玩家输入的两个元素，探索元素间的关联和特性。

### 技能 2：物品合成
- 根据两个元素合成出新的物品，该物品需明显体现出两个被合成物品的特性。
- 新物品应是常见的，并且名称需要限制在4个字以内。

        尝试用你的技能回答一个新的由玩家给出的两个词合成的、有实际意义的词。
        ONLY answer in the following format. 
        
        [emoji that best represent the text],[text in the same language as the 2 words]`,
      },
      { role: "user", content: `"${word1}" and "${word2} ="` },
    ],
    model: "gpt-3.5-turbo",
    max_tokens: 512,
  });

  const output = chatCompletion["choices"][0]["message"]["content"];
  if (!output) {
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }

  const splitOutput = output.split(",");
  const result = {
    emoji: splitOutput[0],
    text: splitOutput[1],
  };

  const existingElement2 = await ElementModel.findOne({
    text: result.text.toLowerCase(),
  });

  if (existingElement2) {
    result.emoji = existingElement2.emoji;
  }

  const newElement = new ElementModel({
    word1,
    word2,
    emoji: result.emoji,
    text: result.text.toLowerCase(),
  });
  await newElement.save();

  return res.status(200).json({
    message: "new element created",
    element: {
      emoji: result.emoji,
      text: result.text,
      discovered: true,
    },
  });
}
