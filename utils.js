export default class Utils {
    static preprocessText(text) {
        return text           
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/'/g, "")
            .replace(/(\r\n|\n|\r)/gm, " ")
            .replace(/[-\u2014\u201d\u201c!.,"]/g, "")
            .replace(/[\u266b]/g, "") //♫
            .replace(/\s+/g, " ");
    }

    static isNumber(word) {
        return /^\d+$/.test(word);
    }
}