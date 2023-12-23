import * as crypto from "crypto";
import axios from "axios";
import { BiliCredential } from "./biliCredential";

export function devIdVerify(devId: string): boolean {
    return /[\dA-F]{8}-[\dA-F]{4}-4[\dA-F]{3}-[\dA-F]{4}-[\dA-F]{12}/.test(devId);
}

export function devIdGen(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, name => {
        const randomInt = 16 * Math.random() | 0;
        return (name === "x" ? randomInt : 3 & randomInt | 8).toString(16).toUpperCase();
    });
}

// 为请求参数进行 wbi 签名
function encWbi(params: any, imgKey: string, subKey: string) {
    const mixinKeyEncTab = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52,
    ];
    // 对 imgKey 和 subKey 进行字符顺序打乱编码
    const getMixinKey = (orig: any) => mixinKeyEncTab.map(n => orig[n]).join("").slice(0, 32);

    const mixinKey = getMixinKey(imgKey + subKey),
        currTime = Math.round(Date.now() / 1000),
        chrFilter = /[!'()*]/g;

    Object.assign(params, { wts: currTime }); // 添加 wts 字段
    // 按照 key 重排参数
    const query = Object
        .keys(params)
        .sort()
        .map(key => {
            // 过滤 value 中的 "!'()*" 字符
            const value = params[key].toString().replace(chrFilter, "");
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join("&");

    // 计算 w_rid
    const wbiSign = crypto.createHash("md5").update(query + mixinKey).digest("hex");
    return query + "&w_rid=" + wbiSign;
}

// 获取最新的 img_key 和 sub_key
async function getWbiKeys(credential: BiliCredential) {
    const res = await axios("https://api.bilibili.com/x/web-interface/nav", {
        headers: { cookies: credential.cookieStr },
    });
    const { data: { wbi_img: { img_url: imgUrl, sub_url: subUrl } } } = await res.data;

    return {
        img_key: imgUrl.slice(
            imgUrl.lastIndexOf("/") + 1,
            imgUrl.lastIndexOf("."),
        ),
        sub_key: subUrl.slice(
            subUrl.lastIndexOf("/") + 1,
            subUrl.lastIndexOf("."),
        ),
    };
}

export async function wbiSign(credential: BiliCredential, params: object) {
    const webKeys = await getWbiKeys(credential);
    const imgKey = webKeys.img_key;
    const subKey = webKeys.sub_key;
    const query = encWbi(params, imgKey, subKey);
    return query;
}
